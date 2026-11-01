import { describe, expect, it } from "vite-plus/test";
import { EMPTY_MATCH_FILTERS } from "./match-filters";
import { calculateStatistics } from "./statistics";
import type { CompletedMatch, PointAttribution } from "./types";

type MatchFixture = {
  id: string;
  completedAt: string;
  teams: string[][];
  winner: number;
  mapId?: string;
  rounds?: PointAttribution[][];
};

function completedMatch(fixture: MatchFixture): CompletedMatch {
  const competitors = fixture.teams.map((playerIds, index) => ({
    id: `competitor-${index}`,
    playerIds,
  }));
  const rounds = (fixture.rounds ?? []).map((attributions, index) => {
    const winner = attributions[0]?.playerId;
    const winnerCompetitor = competitors.find(({ playerIds }) =>
      winner ? playerIds.includes(winner) : false,
    );

    return {
      id: `${fixture.id}-round-${index + 1}`,
      submissionId: `${fixture.id}-submission-${index + 1}`,
      sequence: index + 1,
      scoredAt: fixture.completedAt,
      winnerCompetitorId: winnerCompetitor?.id ?? `competitor-${fixture.winner}`,
      survivingPlayerIds: attributions.map(({ playerId }) => playerId),
      attributions,
      undone: false,
    };
  });

  return {
    id: fixture.id,
    revision: rounds.length,
    status: "completed",
    mapId: fixture.mapId ?? "metro",
    startedAt: fixture.completedAt,
    completedAt: fixture.completedAt,
    pausedAt: null,
    pausedDurationSeconds: 0,
    winnerCompetitorId: `competitor-${fixture.winner}`,
    gameModes: ["Sudden Death"],
    competitors,
    rounds,
  };
}

const mapDetails = [
  { id: "metro", name: "Metro", imagePath: "/resources/maps/metro.png", order: 0 },
  { id: "plaza", name: "Plaza", imagePath: "/resources/maps/plaza.png", order: 3 },
];

describe("player statistics", () => {
  it("counts completed matches by local calendar day for the full-year activity grid", () => {
    const matches = [
      "2025-09-25T12:00:00Z",
      "2026-01-02T01:00:00Z",
      "2026-01-02T02:00:00Z",
      "2026-01-03T12:00:00Z",
    ].map((completedAt, index) =>
      completedMatch({
        id: `activity-${index}`,
        completedAt,
        teams: [["player"], ["opponent"]],
        winner: 0,
      }),
    );
    const stats = calculateStatistics("player", matches, mapDetails, {
      now: new Date("2026-01-04T12:00:00Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(stats.playingActivity.find(({ date }) => date === "2026-01-01")?.matches).toBe(2);
    expect(stats.playingActivity.find(({ date }) => date === "2026-01-03")?.matches).toBe(1);
    expect(stats.playingActivity.find(({ date }) => date === "2025-09-25")?.matches).toBe(1);
    expect(stats.playingActivity.reduce((total, day) => total + day.matches, 0)).toBe(4);
    expect(stats.playingActivity.length).toBeGreaterThanOrEqual(365);
    expect(stats.playingActivity.length).toBeLessThanOrEqual(371);
  });

  it("excludes paused time from completed match durations", () => {
    const pausedMatch = completedMatch({
      id: "paused-match",
      completedAt: "2026-01-01T00:02:00Z",
      teams: [["player"], ["opponent"]],
      winner: 0,
    });
    pausedMatch.startedAt = "2026-01-01T00:00:00Z";
    pausedMatch.pausedDurationSeconds = 30;

    const stats = calculateStatistics("player", [pausedMatch], mapDetails, {
      now: new Date("2026-01-02T00:00:00Z"),
      timeZone: "UTC",
    });

    expect(stats.totalPlayedSeconds).toBe(90);
  });

  it("sums solo and team match durations once per match, excluding unrelated matches", () => {
    const makeMatch = (id: string, teams: string[][], startedAt: string, completedAt: string) => ({
      ...completedMatch({ id, teams, completedAt, winner: 0 }),
      startedAt,
    });
    const matches = [
      makeMatch("solo", [["player"], ["opponent"]], "2026-01-01T00:00:00Z", "2026-01-01T00:10:00Z"),
      makeMatch(
        "team",
        [["player", "teammate"], ["opponent"]],
        "2026-01-02T00:00:00Z",
        "2026-01-02T01:00:00Z",
      ),
      makeMatch(
        "unrelated",
        [["other"], ["opponent"]],
        "2026-01-03T00:00:00Z",
        "2026-01-03T02:00:00Z",
      ),
    ];

    expect(calculateStatistics("player", matches, mapDetails).totalPlayedSeconds).toBe(4200);
  });

  it("uses whole non-negative seconds for match durations", () => {
    const fixture = completedMatch({
      id: "duration",
      teams: [["player"], ["opponent"]],
      winner: 0,
      completedAt: "2026-01-01T00:00:01.900Z",
    });
    expect(
      calculateStatistics(
        "player",
        [
          { ...fixture, startedAt: "2026-01-01T00:00:00.000Z" },
          { ...fixture, id: "negative", startedAt: "2026-01-01T00:01:00.000Z" },
        ],
        mapDetails,
      ).totalPlayedSeconds,
    ).toBe(1);
  });

  it("calculates total, average, shortest, and longest match times for each map", () => {
    const matchWithDuration = (id: string, mapId: string, seconds: number) => {
      const completedAt = "2026-01-01T00:10:00.000Z";
      return {
        ...completedMatch({
          id,
          teams: [["player"], ["opponent"]],
          winner: 0,
          mapId,
          completedAt,
        }),
        startedAt: new Date(Date.parse(completedAt) - seconds * 1000).toISOString(),
      };
    };
    const stats = calculateStatistics(
      "player",
      [
        matchWithDuration("metro-short", "metro", 60),
        matchWithDuration("metro-long", "metro", 61),
        matchWithDuration("plaza", "plaza", 90),
      ],
      mapDetails,
    );

    expect(stats.maps.find(({ mapId }) => mapId === "metro")).toMatchObject({
      totalPlayedSeconds: 121,
      averageMatchSeconds: 61,
      shortestMatchSeconds: 60,
      longestMatchSeconds: 61,
    });
    expect(stats.maps.find(({ mapId }) => mapId === "plaza")).toMatchObject({
      totalPlayedSeconds: 90,
      averageMatchSeconds: 90,
      shortestMatchSeconds: 90,
      longestMatchSeconds: 90,
    });
  });

  it("keeps match wins separate from points earned in losses", () => {
    const matches = [
      completedMatch({
        id: "win",
        completedAt: "2026-01-01T00:00:00.000Z",
        teams: [["player", "teammate"], ["opponent"]],
        winner: 0,
        rounds: [[{ playerId: "player", points: 1 }]],
      }),
      completedMatch({
        id: "loss",
        completedAt: "2026-01-02T00:00:00.000Z",
        teams: [["player"], ["opponent"]],
        winner: 1,
        mapId: "plaza",
        rounds: [[{ playerId: "player", points: 1 }]],
      }),
    ];

    const stats = calculateStatistics("player", matches, mapDetails);

    expect(stats.matchWins).toBe(1);
    expect(stats.matchesPlayed).toBe(2);
    expect(stats.matchWinRate).toBe(0.5);
    expect(stats.roundPoints).toBe(2);
  });

  it("counts flawless wins and shutout losses using full competitor points", () => {
    let day = 1;
    const scoreMatch = (id: string, winner: number, ownPoints: number, opponentPoints: number) =>
      completedMatch({
        id,
        teams: [["player", "teammate"], ["opponent"]],
        winner,
        completedAt: `2026-01-${String(day++).padStart(2, "0")}T00:00:00.000Z`,
        rounds: [
          ...Array.from({ length: ownPoints }, () => [{ playerId: "teammate", points: 1 }]),
          ...Array.from({ length: opponentPoints }, () => [{ playerId: "opponent", points: 1 }]),
        ],
      });
    const flawlessWinWithUndoneOpponentPoint = scoreMatch("flawless", 0, 3, 1);
    const undoneRoundIndex = flawlessWinWithUndoneOpponentPoint.rounds.length - 1;
    flawlessWinWithUndoneOpponentPoint.rounds = flawlessWinWithUndoneOpponentPoint.rounds.map(
      (round, index) => (index === undoneRoundIndex ? { ...round, undone: true } : round),
    );
    const stats = calculateStatistics(
      "player",
      [
        scoreMatch("win", 0, 3, 0),
        scoreMatch("contested-win", 0, 3, 1),
        flawlessWinWithUndoneOpponentPoint,
        scoreMatch("shutout-loss", 1, 0, 3),
        scoreMatch("contested-loss", 1, 1, 3),
      ],
      mapDetails,
    );

    expect(stats.flawlessWins).toBe(2);
    expect(stats.shutoutLosses).toBe(1);
  });

  it("omits maps without completed matches and ranks played maps by win rate", () => {
    const matches = [
      completedMatch({
        id: "metro-win",
        completedAt: "2026-01-01T00:00:00.000Z",
        teams: [["player"], ["a"]],
        winner: 0,
      }),
      completedMatch({
        id: "plaza-loss",
        completedAt: "2026-01-02T00:00:00.000Z",
        teams: [["player"], ["b"]],
        winner: 1,
        mapId: "plaza",
      }),
    ];

    expect(calculateStatistics("player", matches, mapDetails).maps).toEqual([
      {
        mapId: "metro",
        name: "Metro",
        imagePath: "/resources/maps/metro.png",
        order: 0,
        wins: 1,
        matches: 1,
        winRate: 1,
        totalPlayedSeconds: 0,
        averageMatchSeconds: 0,
        shortestMatchSeconds: 0,
        longestMatchSeconds: 0,
      },
      {
        mapId: "plaza",
        name: "Plaza",
        imagePath: "/resources/maps/plaza.png",
        order: 3,
        wins: 0,
        matches: 1,
        winRate: 0,
        totalPlayedSeconds: 0,
        averageMatchSeconds: 0,
        shortestMatchSeconds: 0,
        longestMatchSeconds: 0,
      },
    ]);
  });

  it("excludes teammates from opponent performance", () => {
    const matches = [
      completedMatch({
        id: "opponent",
        completedAt: "2026-01-01T00:00:00.000Z",
        teams: [["player"], ["friend"]],
        winner: 0,
      }),
      completedMatch({
        id: "teammate",
        completedAt: "2026-01-02T00:00:00.000Z",
        teams: [["player", "friend"], ["opponent"]],
        winner: 0,
      }),
    ];

    const stats = calculateStatistics("player", matches, mapDetails);

    expect(stats.opponents).toEqual([
      {
        playerId: "friend",
        wins: 1,
        losses: 0,
        matches: 1,
        winRate: 1,
      },
      {
        playerId: "opponent",
        wins: 1,
        losses: 0,
        matches: 1,
        winRate: 1,
      },
    ]);
  });

  it("counts multiplayer results against the winner, not other losing competitors", () => {
    const match = completedMatch({
      id: "free-for-all",
      completedAt: "2026-01-01T00:00:00.000Z",
      teams: [["player-a"], ["player-b"], ["player-c"]],
      winner: 0,
    });

    const winnerStats = calculateStatistics("player-a", [match], mapDetails);
    expect(winnerStats.opponents).toEqual([
      { playerId: "player-b", wins: 1, losses: 0, matches: 1, winRate: 1 },
      { playerId: "player-c", wins: 1, losses: 0, matches: 1, winRate: 1 },
    ]);

    const secondPlaceStats = calculateStatistics("player-b", [match], mapDetails);
    expect(secondPlaceStats.opponents).toEqual([
      { playerId: "player-a", wins: 0, losses: 1, matches: 1, winRate: 0 },
    ]);

    const thirdPlaceStats = calculateStatistics("player-c", [match], mapDetails);
    expect(thirdPlaceStats.opponents).toEqual([
      { playerId: "player-a", wins: 0, losses: 1, matches: 1, winRate: 0 },
    ]);
  });

  it("ranks partnerships by match win rate and calculates contribution shares", () => {
    const matches = [
      completedMatch({
        id: "partner-win",
        completedAt: "2026-01-01T00:00:00.000Z",
        teams: [["player", "partner"], ["opponent"]],
        winner: 0,
        rounds: [
          [
            { playerId: "player", points: 1 },
            { playerId: "partner", points: 1 },
          ],
        ],
      }),
      completedMatch({
        id: "partner-loss",
        completedAt: "2026-01-02T00:00:00.000Z",
        teams: [["player", "partner"], ["opponent"]],
        winner: 1,
        rounds: [[{ playerId: "player", points: 1 }]],
      }),
      completedMatch({
        id: "no-points",
        completedAt: "2026-01-03T00:00:00.000Z",
        teams: [["player", "new-partner"], ["opponent"]],
        winner: 1,
      }),
    ];

    const stats = calculateStatistics("player", matches, mapDetails);

    expect(stats.partnerships).toEqual([
      {
        teammateId: "partner",
        wins: 1,
        matches: 2,
        winRate: 0.5,
        playerPoints: 2,
        teammatePoints: 1,
        playerShare: 2 / 3,
        teammateShare: 1 / 3,
      },
      {
        teammateId: "new-partner",
        wins: 0,
        matches: 1,
        winRate: 0,
        playerPoints: 0,
        teammatePoints: 0,
        playerShare: null,
        teammateShare: null,
      },
    ]);
  });

  it("uses deterministic completed-match order for current and longest streaks", () => {
    const matches = [
      completedMatch({
        id: "a",
        completedAt: "2026-01-01T00:00:00.000Z",
        teams: [["player"], ["opponent"]],
        winner: 0,
      }),
      completedMatch({
        id: "b",
        completedAt: "2026-01-01T00:00:00.000Z",
        teams: [["player"], ["opponent"]],
        winner: 0,
      }),
      completedMatch({
        id: "c",
        completedAt: "2026-01-02T00:00:00.000Z",
        teams: [["player"], ["opponent"]],
        winner: 1,
      }),
      completedMatch({
        id: "d",
        completedAt: "2026-01-03T00:00:00.000Z",
        teams: [["player"], ["opponent"]],
        winner: 1,
      }),
    ];

    const stats = calculateStatistics("player", matches, mapDetails);

    expect(stats.currentStreak).toEqual({ kind: "loss", length: 2 });
    expect(stats.longestWinStreak).toEqual({
      length: 2,
      firstMatchId: "a",
      lastMatchId: "b",
    });
    expect(stats.longestLossStreak).toEqual({
      length: 2,
      firstMatchId: "c",
      lastMatchId: "d",
    });
  });

  it("returns safe empty values for a player without completed matches", () => {
    const stats = calculateStatistics("player", [], mapDetails);

    expect(stats.matchesPlayed).toBe(0);
    expect(stats.totalPlayedSeconds).toBe(0);
    expect(stats.matchWinRate).toBeNull();
    expect(stats.maps).toEqual([]);
    expect(stats.opponents).toEqual([]);
    expect(stats.partnerships).toEqual([]);
    expect(stats.currentStreak).toEqual({ kind: "none", length: 0 });
    expect(stats.longestWinStreak.length).toBe(0);
    expect(stats.longestLossStreak.length).toBe(0);
    expect(stats.playingDayStreak).toEqual({ current: 0, longest: 0 });
  });
});

describe("daily play streaks", () => {
  function statisticsForDays(completedDays: string[], now: string, timeZone = "UTC") {
    return calculateStatistics(
      "player",
      completedDays.map((completedAt, index) =>
        completedMatch({
          id: `daily-${index}`,
          completedAt,
          teams: [["player"], ["opponent"]],
          winner: index % 2,
        }),
      ),
      mapDetails,
      { timeZone, now: new Date(now) },
    ).playingDayStreak;
  }

  it("counts distinct played days independently of wins, losses, and match order", () => {
    expect(
      statisticsForDays(
        [
          "2026-01-03T15:00:00Z",
          "2026-01-01T12:00:00Z",
          "2026-01-02T12:00:00Z",
          "2026-01-03T18:00:00Z",
          "2026-01-06T12:00:00Z",
          "2026-01-07T12:00:00Z",
        ],
        "2026-01-07T18:00:00Z",
      ),
    ).toEqual({ current: 2, longest: 3 });
  });

  describe("filtered statistics", () => {
    it("calculates all-time totals from selected filters and compares with the equal preceding date range", () => {
      const matches = [
        completedMatch({
          id: "selected",
          completedAt: "2026-03-15T12:00:00Z",
          teams: [["player", "ally"], ["foe"]],
          winner: 0,
          mapId: "metro",
        }),
        completedMatch({
          id: "previous",
          completedAt: "2026-03-14T12:00:00Z",
          teams: [["player", "ally"], ["foe"]],
          winner: 1,
          mapId: "metro",
        }),
        completedMatch({
          id: "wrong-map",
          completedAt: "2026-03-15T12:00:00Z",
          teams: [["player", "ally"], ["foe"]],
          winner: 0,
          mapId: "plaza",
        }),
        completedMatch({
          id: "other-partner",
          completedAt: "2026-02-15T12:00:00Z",
          teams: [["player", "other-ally"], ["foe"]],
          winner: 0,
          mapId: "metro",
        }),
      ];
      const stats = calculateStatistics("player", matches, mapDetails, {
        timeZone: "UTC",
        now: new Date("2026-04-01T00:00:00Z"),
        filters: {
          ...EMPTY_MATCH_FILTERS,
          startDate: "2026-03-15",
          endDate: "2026-03-15",
          mapIds: ["metro"],
          teammateIds: ["ally"],
          opponentIds: ["foe"],
        },
      });

      expect(stats.matchesPlayed).toBe(1);
      expect(stats.matchWins).toBe(1);
      expect(stats.monthlyComparison.current).toMatchObject({
        matchesPlayed: 1,
        matchWinRate: 1,
      });
      expect(stats.monthlyComparison.previous).toMatchObject({
        matchesPlayed: 1,
        matchWinRate: 0,
      });
      expect(stats.monthlyComparison.currentMonth).toContain("Mar 15");
      expect(stats.monthlyComparison.previousMonth).toContain("Mar 14");
    });
  });

  it("keeps yesterday's streak active until a calendar day is missed", () => {
    const days = ["2026-01-01T12:00:00Z", "2026-01-02T12:00:00Z"];
    expect(statisticsForDays(days, "2026-01-03T23:59:59Z")).toEqual({ current: 2, longest: 2 });
    expect(statisticsForDays(days, "2026-01-04T00:00:00Z")).toEqual({ current: 0, longest: 2 });
  });

  it("groups matches by the player's timezone instead of UTC", () => {
    const days = ["2026-01-01T23:00:00Z", "2026-01-02T01:00:00Z"];
    expect(statisticsForDays(days, "2026-01-02T12:00:00Z", "America/Los_Angeles")).toEqual({
      current: 1,
      longest: 1,
    });
    expect(statisticsForDays(days, "2026-01-02T12:00:00Z", "UTC")).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("uses local today when determining whether the streak is still active", () => {
    const days = ["2026-01-01T12:00:00Z"];
    expect(statisticsForDays(days, "2026-01-03T01:00:00Z", "America/Los_Angeles")).toEqual({
      current: 1,
      longest: 1,
    });
    expect(statisticsForDays(days, "2026-01-03T01:00:00Z", "UTC")).toEqual({
      current: 0,
      longest: 1,
    });
  });

  it.each([
    ["2026-03-28T11:00:00Z", "2026-03-29T10:00:00Z", "2026-03-30T10:00:00Z"],
    ["2026-10-24T10:00:00Z", "2026-10-25T11:00:00Z", "2026-10-26T11:00:00Z"],
    ["2025-12-31T12:00:00Z", "2026-01-01T12:00:00Z", "2026-01-02T12:00:00Z"],
    ["2024-02-28T12:00:00Z", "2024-02-29T12:00:00Z", "2024-03-01T12:00:00Z"],
  ])("counts consecutive days across daylight-saving and date boundaries: %s", (...days) => {
    expect(statisticsForDays(days, days[2], "Europe/Copenhagen")).toEqual({
      current: 3,
      longest: 3,
    });
  });

  it("excludes days on which only other players played", () => {
    const matches = [
      completedMatch({
        id: "own",
        completedAt: "2026-01-01T12:00:00Z",
        teams: [["player"], ["opponent"]],
        winner: 0,
      }),
      completedMatch({
        id: "unrelated",
        completedAt: "2026-01-02T12:00:00Z",
        teams: [["other"], ["opponent"]],
        winner: 0,
      }),
    ];
    expect(
      calculateStatistics("player", matches, mapDetails, {
        timeZone: "UTC",
        now: new Date("2026-01-03T12:00:00Z"),
      }).playingDayStreak,
    ).toEqual({ current: 0, longest: 1 });
  });
});
