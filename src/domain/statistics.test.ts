import { describe, expect, it } from "vitest";
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
    winnerCompetitorId: `competitor-${fixture.winner}`,
    competitors,
    rounds,
  };
}

const mapDetails = [
  { id: "metro", name: "Metro", order: 0 },
  { id: "plaza", name: "Plaza", order: 3 },
];

describe("player statistics", () => {
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

  it("keeps match wins separate from point credits earned in losses", () => {
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
    expect(stats.roundCredits).toBe(2);
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
        order: 0,
        wins: 1,
        matches: 1,
        winRate: 1,
      },
      {
        mapId: "plaza",
        name: "Plaza",
        order: 3,
        wins: 0,
        matches: 1,
        winRate: 0,
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
  });
});
