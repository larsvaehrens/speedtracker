import { describe, expect, it } from "vitest";
import {
  getDatePresetRange,
  matchesFilters,
  precedingDateRange,
  type DatePreset,
  type MatchFilters,
} from "./match-filters";
import type { CompletedMatch } from "./types";

function match({
  completedAt = "2026-04-15T18:00:00Z",
  mapId = "map-a",
  competitors = [
    { id: "own", playerIds: ["player", "ally-a"] },
    { id: "other", playerIds: ["opponent-a", "opponent-b"] },
  ],
}: {
  completedAt?: string;
  mapId?: string;
  competitors?: CompletedMatch["competitors"];
} = {}): CompletedMatch {
  return {
    id: "match",
    revision: 1,
    status: "completed",
    mapId,
    startedAt: completedAt,
    completedAt,
    pausedAt: null,
    pausedDurationSeconds: 0,
    winnerCompetitorId: "own",
    gameModes: ["Sudden Death"],
    competitors,
    rounds: [],
  };
}

const noFilters: MatchFilters = {
  startDate: "",
  endDate: "",
  mapIds: [],
  teammateIds: [],
  opponentIds: [],
  gameModes: [],
};

describe("match filters", () => {
  it("matches any selected teammate or opponent while keeping roles distinct", () => {
    const fixture = match();
    expect(
      matchesFilters(
        fixture,
        "player",
        {
          ...noFilters,
          teammateIds: ["ally-missing", "ally-a"],
          opponentIds: ["opponent-missing", "opponent-b"],
        },
        "UTC",
      ),
    ).toBe(true);
    expect(
      matchesFilters(fixture, "player", { ...noFilters, teammateIds: ["opponent-a"] }, "UTC"),
    ).toBe(false);
    expect(
      matchesFilters(fixture, "player", { ...noFilters, opponentIds: ["ally-a"] }, "UTC"),
    ).toBe(false);
  });

  it("combines selected maps, teammates, opponents, and local inclusive dates", () => {
    expect(
      matchesFilters(
        match({ completedAt: "2026-04-16T06:59:00Z" }),
        "player",
        {
          ...noFilters,
          startDate: "2026-04-15",
          endDate: "2026-04-15",
          mapIds: ["map-a"],
          teammateIds: ["ally-a"],
          opponentIds: ["opponent-b"],
        },
        "America/Los_Angeles",
      ),
    ).toBe(true);
    expect(
      matchesFilters(
        match({ completedAt: "2026-04-16T07:00:00Z" }),
        "player",
        { ...noFilters, endDate: "2026-04-15" },
        "America/Los_Angeles",
      ),
    ).toBe(false);
  });

  it("matches a match when any selected game mode is enabled", () => {
    const fixture = match();
    expect(
      matchesFilters(
        { ...fixture, gameModes: ["Lethal Spikes", "SpeedRapture"] },
        "player",
        { ...noFilters, gameModes: ["SuperSpeedRunners", "SpeedRapture"] },
        "UTC",
      ),
    ).toBe(true);
    expect(
      matchesFilters(fixture, "player", { ...noFilters, gameModes: ["Lethal Spikes"] }, "UTC"),
    ).toBe(false);
  });

  it("creates calendar-based week, month, quarter, and year suggestions", () => {
    const now = new Date(2026, 0, 1, 12);
    const expected: Record<DatePreset, { startDate: string; endDate: string }> = {
      "this-week": { startDate: "2025-12-29", endDate: "2026-01-01" },
      "last-week": { startDate: "2025-12-22", endDate: "2025-12-28" },
      "this-month": { startDate: "2026-01-01", endDate: "2026-01-01" },
      "last-month": { startDate: "2025-12-01", endDate: "2025-12-31" },
      "this-quarter": { startDate: "2026-01-01", endDate: "2026-01-01" },
      "last-quarter": { startDate: "2025-10-01", endDate: "2025-12-31" },
      "this-year": { startDate: "2026-01-01", endDate: "2026-01-01" },
      "last-year": { startDate: "2025-01-01", endDate: "2025-12-31" },
    };
    for (const [preset, range] of Object.entries(expected) as [
      DatePreset,
      (typeof expected)[DatePreset],
    ][]) {
      expect(getDatePresetRange(preset, now)).toEqual(range);
    }
  });

  it("builds an immediately preceding inclusive range of equal length", () => {
    expect(precedingDateRange({ startDate: "2026-03-01", endDate: "2026-03-31" })).toEqual({
      startDate: "2026-01-29",
      endDate: "2026-02-28",
    });
  });
});
