import { describe, expect, it } from "vitest";
import { calculateStatistics } from "./statistics";
import type { CompletedMatch } from "./types";

const maps = [{ id: "map", name: "Map", imagePath: "/map.png", order: 0 }];

function match(
  completedAt: string,
  { won = true, points = 1, duration = 60, team = false, player = "player" } = {},
): CompletedMatch {
  return {
    id: completedAt,
    revision: 1,
    status: "completed",
    mapId: "map",
    startedAt: new Date(Date.parse(completedAt) - duration * 1000).toISOString(),
    completedAt,
    winnerCompetitorId: won ? "own" : "opposition",
    gameModes: ["Sudden Death"],
    competitors: [
      { id: "own", playerIds: team ? [player, "teammate"] : [player] },
      { id: "opposition", playerIds: ["opponent"] },
    ],
    rounds: [
      {
        id: `round-${completedAt}`,
        submissionId: completedAt,
        sequence: 1,
        scoredAt: completedAt,
        winnerCompetitorId: "own",
        survivingPlayerIds: [player],
        attributions: [{ playerId: player, points }],
        undone: false,
      },
    ],
  };
}

function statistics(matches: CompletedMatch[], now: string, timeZone = "UTC") {
  return calculateStatistics("player", matches, maps, { now: new Date(now), timeZone });
}

describe("monthly statistics comparisons", () => {
  it("compares matching month-to-date periods while preserving all-time values", () => {
    const stats = statistics(
      [
        match("2026-09-01T00:00:00Z", { points: 2, duration: 120, team: true }),
        match("2026-09-15T12:00:00Z", { won: false, points: 1, duration: 60, team: true }),
        match("2026-09-15T12:00:00.001Z"),
        match("2026-08-01T00:00:00Z", { team: true }),
        match("2026-08-15T12:00:00Z", { team: true }),
        match("2026-08-15T12:00:00.001Z", { won: false }),
        match("2026-07-15T12:00:00Z", { won: false }),
        match("2026-09-10T12:00:00Z", { player: "unrelated" }),
      ],
      "2026-09-15T12:00:00Z",
    );
    expect(stats.matchesPlayed).toBe(7);
    expect(stats.monthlyComparison).toMatchObject({
      currentMonth: "September 2026",
      previousMonth: "August 2026",
      current: { matchesPlayed: 2, matchWinRate: 0.5, roundCredits: 3, totalPlayedSeconds: 180 },
      previous: { matchesPlayed: 2, matchWinRate: 1, roundCredits: 2, totalPlayedSeconds: 120 },
    });
    expect(stats.monthlyComparison.current.maps[0]).toMatchObject({
      mapId: "map",
      matches: 2,
      winRate: 0.5,
    });
    expect(stats.monthlyComparison.previous.maps[0]).toMatchObject({ matches: 2, winRate: 1 });
    expect(stats.monthlyComparison.current.opponents[0]).toMatchObject({
      playerId: "opponent",
      matches: 2,
      winRate: 0.5,
    });
    expect(stats.monthlyComparison.previous.opponents[0]).toMatchObject({ matches: 2, winRate: 1 });
    expect(stats.monthlyComparison.current.partnerships[0]).toMatchObject({
      teammateId: "teammate",
      matches: 2,
      winRate: 0.5,
    });
    expect(stats.monthlyComparison.previous.partnerships[0]).toMatchObject({
      matches: 2,
      winRate: 1,
    });
  });

  it("uses local month boundaries and local cutoff time rather than UTC", () => {
    const stats = statistics(
      [
        match("2026-03-01T07:59:59Z"),
        match("2026-03-01T08:00:00Z"),
        match("2026-03-15T19:00:00Z"),
        match("2026-03-15T19:00:01Z"),
        match("2026-02-15T20:00:00Z"),
        match("2026-02-15T20:00:01Z"),
      ],
      "2026-03-15T19:00:00Z",
      "America/Los_Angeles",
    );
    expect(stats.monthlyComparison.current.matchesPlayed).toBe(2);
    expect(stats.monthlyComparison.previous.matchesPlayed).toBe(1);
  });

  it("chooses the current month from local today near a UTC month boundary", () => {
    const stats = statistics(
      [
        match("2026-02-01T08:00:00Z"),
        match("2026-03-01T01:00:00Z"),
        match("2026-01-29T01:00:00Z"),
        match("2026-01-29T03:00:00Z"),
      ],
      "2026-03-01T02:00:00Z",
      "America/Los_Angeles",
    );
    expect(stats.monthlyComparison.currentMonth).toBe("February 2026");
    expect(stats.monthlyComparison.previousMonth).toBe("January 2026");
    expect(stats.monthlyComparison.current.matchesPlayed).toBe(2);
    expect(stats.monthlyComparison.previous.matchesPlayed).toBe(1);
  });

  it.each([
    ["2026-03-31T12:00:00Z", "2026-02-28T23:59:59Z"],
    ["2024-03-31T12:00:00Z", "2024-02-29T23:59:59Z"],
    ["2026-05-31T12:00:00Z", "2026-04-30T23:59:59Z"],
  ])("caps the previous period at the shorter month's end for %s", (now, previousLastDay) => {
    const stats = statistics([match(previousLastDay)], now);
    expect(stats.monthlyComparison.previous.matchesPlayed).toBe(1);
  });

  it("does not include the rest of the previous month's last day when the cutoff day exists", () => {
    const stats = statistics(
      [match("2026-02-28T12:00:00Z"), match("2026-02-28T12:00:01Z")],
      "2026-03-28T12:00:00Z",
    );
    expect(stats.monthlyComparison.previous.matchesPlayed).toBe(1);
  });

  it("handles the December-to-January year boundary", () => {
    const stats = statistics(
      [match("2025-12-10T12:00:00Z"), match("2025-12-10T12:00:01Z"), match("2026-01-10T12:00:00Z")],
      "2026-01-10T12:00:00Z",
    );
    expect(stats.monthlyComparison.previousMonth).toBe("December 2025");
    expect(stats.monthlyComparison.currentMonth).toBe("January 2026");
    expect(stats.monthlyComparison.current.matchesPlayed).toBe(1);
    expect(stats.monthlyComparison.previous.matchesPlayed).toBe(1);
  });

  it("does not invent a zero win rate for a period without matches", () => {
    const stats = statistics([match("2026-07-01T00:00:00Z")], "2026-09-15T12:00:00Z");
    expect(stats.monthlyComparison.current).toMatchObject({
      matchesPlayed: 0,
      matchWinRate: null,
      roundCredits: 0,
      totalPlayedSeconds: 0,
    });
    expect(stats.monthlyComparison.previous).toMatchObject({
      matchesPlayed: 0,
      matchWinRate: null,
    });
    expect(stats.monthlyComparison.current.maps).toEqual([]);
    expect(stats.monthlyComparison.previous.opponents).toEqual([]);
  });

  it("excludes undone round credits from both comparison periods", () => {
    const current = match("2026-09-01T00:00:00Z", { points: 2 });
    current.rounds[0].undone = true;
    const stats = statistics([current, match("2026-08-01T00:00:00Z")], "2026-09-15T12:00:00Z");
    expect(stats.monthlyComparison.current.roundCredits).toBe(0);
    expect(stats.monthlyComparison.previous.roundCredits).toBe(1);
  });
});
