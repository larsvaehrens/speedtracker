import type { Competitor, MatchState, PointAttribution, RoundResult } from "./types";

export const SOLO_VICTORY_THRESHOLD = 3;
export const TEAM_VICTORY_THRESHOLD = 4;

export type RoundInput = {
  id: string;
  submissionId: string;
  winnerCompetitorId: string;
  survivingPlayerIds: string[];
};

export type ScoreError =
  | "match-not-editable"
  | "stale-match"
  | "duplicate-submission"
  | "unknown-competitor"
  | "invalid-survivors"
  | "missing-map"
  | "no-round-to-undo"
  | "correction-required";

export type ScoreResult =
  | { ok: true; match: MatchState; round?: RoundResult }
  | { ok: false; error: ScoreError };

function activeRounds(match: MatchState): RoundResult[] {
  return match.rounds.filter((round) => !round.undone);
}

export function getCompetitorScore(match: MatchState, competitorId: string): number {
  const playerIds =
    match.competitors.find((competitor) => competitor.id === competitorId)?.playerIds ?? [];
  const memberIds = new Set(playerIds);

  return activeRounds(match).reduce(
    (score, round) =>
      score +
      round.attributions
        .filter((attribution) => memberIds.has(attribution.playerId))
        .reduce((total, attribution) => total + attribution.points, 0),
    0,
  );
}

export function getPlayerPoints(match: MatchState, playerId: string): number {
  return activeRounds(match).reduce(
    (total, round) =>
      total +
      round.attributions
        .filter((attribution) => attribution.playerId === playerId)
        .reduce((points, attribution) => points + attribution.points, 0),
    0,
  );
}

function getWinnerAfterRound(match: MatchState, newRound: RoundResult): Competitor | null {
  const competitor = match.competitors.find(({ id }) => id === newRound.winnerCompetitorId);
  if (!competitor) return null;

  const score =
    getCompetitorScore(match, competitor.id) +
    newRound.attributions.reduce((total, value) => total + value.points, 0);
  const threshold =
    competitor.playerIds.length === 1 ? SOLO_VICTORY_THRESHOLD : TEAM_VICTORY_THRESHOLD;

  return score >= threshold ? competitor : null;
}

function buildAttributions(survivingPlayerIds: string[]): PointAttribution[] {
  return survivingPlayerIds.map((playerId) => ({ playerId, points: 1 }));
}

export function recordRound(
  match: MatchState,
  input: RoundInput,
  expectedRevision: number,
  completedAt: string,
): ScoreResult {
  if (match.status !== "active") {
    return { ok: false, error: "match-not-editable" };
  }
  if (match.revision !== expectedRevision) {
    return { ok: false, error: "stale-match" };
  }
  if (match.rounds.some((round) => round.submissionId === input.submissionId)) {
    return { ok: false, error: "duplicate-submission" };
  }

  const competitor = match.competitors.find(({ id }) => id === input.winnerCompetitorId);
  if (!competitor) return { ok: false, error: "unknown-competitor" };

  const survivors = new Set(input.survivingPlayerIds);
  if (
    survivors.size !== input.survivingPlayerIds.length ||
    survivors.size < 1 ||
    survivors.size > competitor.playerIds.length ||
    input.survivingPlayerIds.some((playerId) => !competitor.playerIds.includes(playerId)) ||
    (competitor.playerIds.length === 1 && survivors.size !== 1)
  ) {
    return { ok: false, error: "invalid-survivors" };
  }

  const round: RoundResult = {
    id: input.id,
    submissionId: input.submissionId,
    sequence:
      match.rounds.reduce((lastSequence, item) => Math.max(lastSequence, item.sequence), 0) + 1,
    winnerCompetitorId: competitor.id,
    survivingPlayerIds: [...survivors],
    attributions: buildAttributions([...survivors]),
    undone: false,
  };
  const winner = getWinnerAfterRound(match, round);
  const status = winner ? (match.mapId ? "completed" : "awaiting-map") : "active";

  return {
    ok: true,
    round,
    match: {
      ...match,
      revision: match.revision + 1,
      status,
      completedAt: status === "completed" ? completedAt : null,
      winnerCompetitorId: winner?.id ?? null,
      rounds: [...match.rounds, round],
    },
  };
}

export function selectMap(match: MatchState, mapId: string, completedAt: string): ScoreResult {
  if (match.status === "completed" || match.status === "abandoned") {
    return { ok: false, error: "match-not-editable" };
  }

  if (match.status === "awaiting-map") {
    return {
      ok: true,
      match: {
        ...match,
        revision: match.revision + 1,
        mapId,
        status: "completed",
        completedAt,
      },
    };
  }

  return {
    ok: true,
    match: { ...match, revision: match.revision + 1, mapId },
  };
}

export function undoLastRound(
  match: MatchState,
  options: { reopenCompleted?: boolean } = {},
): ScoreResult {
  if (match.status === "abandoned") {
    return { ok: false, error: "match-not-editable" };
  }
  if (match.status === "completed" && !options.reopenCompleted) {
    return { ok: false, error: "correction-required" };
  }

  const lastRound = activeRounds(match).at(-1);
  if (!lastRound) return { ok: false, error: "no-round-to-undo" };

  const rounds = match.rounds.map((round) =>
    round.id === lastRound.id ? { ...round, undone: true } : round,
  );

  return {
    ok: true,
    match: {
      ...match,
      revision: match.revision + 1,
      status: "active",
      completedAt: null,
      winnerCompetitorId: null,
      rounds,
    },
  };
}

export function abandonMatch(match: MatchState): ScoreResult {
  if (match.status === "completed" || match.status === "abandoned") {
    return { ok: false, error: "match-not-editable" };
  }

  return {
    ok: true,
    match: {
      ...match,
      revision: match.revision + 1,
      status: "abandoned",
      completedAt: null,
      winnerCompetitorId: null,
    },
  };
}

export function isCompletedWithMap(match: MatchState): boolean {
  return match.status === "completed" && match.mapId !== null;
}
