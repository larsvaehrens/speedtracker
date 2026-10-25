import { describe, expect, it } from "vite-plus/test";
import {
  getCompetitorScore,
  getPlayerPoints,
  recordRound,
  selectMap,
  undoLastRound,
} from "./scoring";
import type { MatchState } from "./types";

function newMatch(teamSizes: number[], mapId: string | null = "metro"): MatchState {
  let playerNumber = 0;

  return {
    id: "match",
    revision: 0,
    status: "active",
    mapId,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    pausedAt: null,
    pausedDurationSeconds: 0,
    winnerCompetitorId: null,
    gameModes: ["Sudden Death"],
    competitors: teamSizes.map((size, competitorIndex) => ({
      id: `competitor-${competitorIndex}`,
      playerIds: Array.from({ length: size }, () => `player-${playerNumber++}`),
    })),
    rounds: [],
  };
}

function score(
  match: MatchState,
  competitorId: string,
  survivingPlayerIds: string[],
  submissionId: string,
) {
  return recordRound(
    match,
    {
      id: `round-${submissionId}`,
      submissionId,
      winnerCompetitorId: competitorId,
      survivingPlayerIds,
    },
    match.revision,
    "2026-01-01T00:01:00.000Z",
  );
}

describe("round scoring", () => {
  it("rejects scoring while the match is paused", () => {
    const match = { ...newMatch([1, 1]), pausedAt: "2026-01-01T00:00:30.000Z" };
    expect(score(match, "competitor-0", ["player-0"], "paused-score")).toEqual({
      ok: false,
      error: "match-not-editable",
    });
  });

  it.each([
    [[1, 1], "competitor-0"],
    [[1, 1, 1], "competitor-0"],
    [[1, 1, 1, 1], "competitor-0"],
    [[2, 2], "competitor-0"],
    [[1, 2], "competitor-0"],
    [[1, 1, 2], "competitor-2"],
  ])("records a winner for arrangement %j", (teamSizes, winnerId) => {
    const match = newMatch(teamSizes);
    const winner = match.competitors.find(({ id }) => id === winnerId);
    if (!winner) throw new Error("Test competitor was not created");

    const result = score(match, winner.id, [winner.playerIds[0]!], "round-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.round?.winnerCompetitorId).toBe(winner.id);
    expect(result.round?.scoredAt).toBe("2026-01-01T00:01:00.000Z");
    expect(getCompetitorScore(result.match, winner.id)).toBe(1);
  });

  it("awards one point to a surviving teammate and team", () => {
    const match = newMatch([2, 2]);
    const result = score(match, "competitor-0", ["player-0"], "round-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.round?.attributions).toEqual([{ playerId: "player-0", points: 1 }]);
    expect(getCompetitorScore(result.match, "competitor-0")).toBe(1);
    expect(getPlayerPoints(result.match, "player-1")).toBe(0);
  });

  it("awards one point to each surviving teammate and two to the team", () => {
    const match = newMatch([2, 2]);
    const result = score(match, "competitor-0", ["player-0", "player-1"], "round-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getCompetitorScore(result.match, "competitor-0")).toBe(2);
    expect(getPlayerPoints(result.match, "player-0")).toBe(1);
    expect(getPlayerPoints(result.match, "player-1")).toBe(1);
  });

  it("completes a solo match at three points", () => {
    let match = newMatch([1, 1]);

    for (let index = 1; index <= 3; index += 1) {
      const result = score(match, "competitor-0", ["player-0"], `round-${index}`);
      expect(result.ok).toBe(true);
      if (result.ok) match = result.match;
    }

    expect(match.status).toBe("completed");
    expect(match.winnerCompetitorId).toBe("competitor-0");
    expect(getCompetitorScore(match, "competitor-0")).toBe(3);
  });

  it("uses the mixed-format thresholds and ends a team match at or above four", () => {
    let match = newMatch([1, 2]);
    const first = score(match, "competitor-1", ["player-1"], "round-1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    match = first.match;

    const second = score(match, "competitor-1", ["player-1"], "round-2");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    match = second.match;

    const third = score(match, "competitor-1", ["player-1"], "round-3");
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    match = third.match;
    expect(match.status).toBe("active");

    const fourth = score(match, "competitor-1", ["player-1", "player-2"], "round-4");
    expect(fourth.ok).toBe(true);
    if (!fourth.ok) return;
    expect(getCompetitorScore(fourth.match, "competitor-1")).toBe(5);
    expect(fourth.match.status).toBe("completed");
    expect(fourth.match.winnerCompetitorId).toBe("competitor-1");
  });

  it("keeps a winning round while waiting for a required map", () => {
    let match = newMatch([1, 1], null);

    for (let index = 1; index <= 3; index += 1) {
      const result = score(match, "competitor-0", ["player-0"], `round-${index}`);
      expect(result.ok).toBe(true);
      if (result.ok) match = result.match;
    }

    expect(match.status).toBe("awaiting-map");
    expect(match.rounds).toHaveLength(3);
    expect(getCompetitorScore(match, "competitor-0")).toBe(3);

    const completed = selectMap(match, "metro", "2026-01-01T00:02:00.000Z");
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.match.status).toBe("completed");
    expect(completed.match.rounds).toHaveLength(3);
  });

  it("rejects duplicate and stale submissions", () => {
    const match = newMatch([1, 1]);
    const first = score(match, "competitor-0", ["player-0"], "same-request");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(
      recordRound(
        first.match,
        {
          id: "round-retry",
          submissionId: "same-request",
          winnerCompetitorId: "competitor-0",
          survivingPlayerIds: ["player-0"],
        },
        first.match.revision,
        "2026-01-01T00:02:00.000Z",
      ),
    ).toEqual({ ok: false, error: "duplicate-submission" });

    expect(
      recordRound(
        first.match,
        {
          id: "round-stale",
          submissionId: "new-request",
          winnerCompetitorId: "competitor-0",
          survivingPlayerIds: ["player-0"],
        },
        0,
        "2026-01-01T00:02:00.000Z",
      ),
    ).toEqual({ ok: false, error: "stale-match" });
  });

  it("undoes a result and requires explicit correction after completion", () => {
    let match = newMatch([1, 1]);
    for (let index = 1; index <= 3; index += 1) {
      const result = score(match, "competitor-0", ["player-0"], `round-${index}`);
      if (result.ok) match = result.match;
    }

    expect(undoLastRound(match)).toEqual({
      ok: false,
      error: "correction-required",
    });
    const correction = undoLastRound(match, { reopenCompleted: true });
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.match.status).toBe("active");
    expect(getCompetitorScore(correction.match, "competitor-0")).toBe(2);
    expect(correction.match.rounds[2]?.undone).toBe(true);
  });
});
