import { env } from "cloudflare:workers";
import { canEditMatch } from "#/domain/permissions";
import { abandonMatch, recordRound, selectMap, undoLastRound } from "#/domain/scoring";
import { validateSetup, type CompetitorSetup } from "#/domain/setup";
import type { MatchState, RoundResult } from "#/domain/types";
import { DEFAULT_GAME_MODES, type GameMode } from "#/domain/game-modes";
import type { MatchView } from "#/domain/views";
import { getEligiblePlayers, getMatch, setupEligibility } from "./data";

export type MatchMutation =
  | { ok: true; match: MatchView; idempotent?: boolean }
  | {
      ok: false;
      status: 400 | 404 | 409;
      error: string;
      match?: MatchView;
    };

function toState(match: MatchView): MatchState {
  return {
    id: match.id,
    revision: match.revision,
    status: match.status,
    mapId: match.mapId,
    startedAt: match.startedAt,
    completedAt: match.completedAt,
    pausedAt: match.pausedAt,
    pausedDurationSeconds: match.pausedDurationSeconds,
    winnerCompetitorId: match.winnerCompetitorId,
    gameModes: match.gameModes,
    competitors: match.competitors.map(({ id, playerIds }) => ({
      id,
      playerIds,
    })),
    rounds: match.rounds,
  };
}

async function isCreator(matchId: string, playerId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT creator_id FROM matches WHERE id = ?")
    .bind(matchId)
    .first<{ creator_id: string }>();

  return row !== null && canEditMatch(row.creator_id, playerId);
}

async function mapExists(mapId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS found FROM maps WHERE id = ?")
    .bind(mapId)
    .first<{ found: number }>();

  return row !== null;
}

export async function createMatch(
  creatorId: string,
  competitors: CompetitorSetup[],
  mapId: string | null,
  gameModes: GameMode[] = DEFAULT_GAME_MODES,
): Promise<MatchMutation> {
  const players = await getEligiblePlayers(creatorId);
  const setupError = validateSetup(competitors, creatorId, setupEligibility(creatorId, players));

  if (setupError) {
    return {
      ok: false,
      status: 400,
      error: `Invalid Setup: ${setupError}.`,
    };
  }
  if (mapId && !(await mapExists(mapId))) {
    return { ok: false, status: 400, error: "Choose a valid map." };
  }

  const matchId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const matchStatements = [
    env.DB.prepare(
      `INSERT INTO matches
        (id, creator_id, map_id, status, revision, game_modes, started_at, created_at)
       VALUES (?, ?, ?, 'active', 0, ?, ?, ?)`,
    ).bind(matchId, creatorId, mapId, JSON.stringify(gameModes), startedAt, startedAt),
  ];

  for (const [competitorIndex, competitor] of competitors.entries()) {
    const competitorId = crypto.randomUUID();
    matchStatements.push(
      env.DB.prepare(
        `INSERT INTO competitors (id, match_id, kind, sort_order)
         VALUES (?, ?, ?, ?)`,
      ).bind(
        competitorId,
        matchId,
        competitor.playerIds.length === 1 ? "solo" : "team",
        competitorIndex,
      ),
    );

    for (const [memberIndex, playerId] of competitor.playerIds.entries()) {
      matchStatements.push(
        env.DB.prepare(
          `INSERT INTO competitor_members
            (match_id, competitor_id, player_id, sort_order)
           VALUES (?, ?, ?, ?)`,
        ).bind(matchId, competitorId, playerId, memberIndex),
      );
    }
  }

  const participantIds = [...new Set(competitors.flatMap((competitor) => competitor.playerIds))];
  for (const playerId of participantIds) {
    for (const otherId of participantIds) {
      if (playerId === otherId) continue;
      matchStatements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at)
           VALUES (?, ?, ?)`,
        ).bind(playerId, otherId, startedAt),
      );
    }
  }

  await env.DB.batch(matchStatements);
  const match = await getMatch(matchId, creatorId);
  if (!match) {
    throw new Error("The new match could not be read after creation.");
  }

  return { ok: true, match };
}

export async function setMatchPaused(
  matchId: string,
  creatorId: string,
  revision: number,
  paused: boolean,
): Promise<MatchMutation> {
  if (!(await isCreator(matchId, creatorId))) {
    return { ok: false, status: 404, error: "Match not found." };
  }
  const current = await getMatch(matchId, creatorId);
  if (!current) return { ok: false, status: 404, error: "Match not found." };
  const pausedAt = current.pausedAt;
  if (
    current.status !== "active" ||
    current.revision !== revision ||
    (paused ? pausedAt !== null : pausedAt === null)
  ) {
    return {
      ok: false,
      status: 409,
      error: "The match changed. Refresh its current state before pausing or resuming.",
      match: current,
    };
  }

  const now = new Date().toISOString();
  const pausedDurationSeconds = paused
    ? current.pausedDurationSeconds
    : current.pausedDurationSeconds +
      Math.max(0, Math.floor((Date.parse(now) - Date.parse(pausedAt ?? now)) / 1000));
  const update = await env.DB.prepare(
    `UPDATE matches
     SET paused_at = ?, paused_duration_seconds = ?, revision = revision + 1
     WHERE id = ? AND revision = ? AND status = 'active'
       AND paused_at IS ?`,
  )
    .bind(paused ? now : null, pausedDurationSeconds, matchId, revision, current.pausedAt)
    .run();

  if (update.meta.changes !== 1) {
    const latest = await getMatch(matchId, creatorId);
    return {
      ok: false,
      status: 409,
      error: "The match changed. Refresh its current state before pausing or resuming.",
      match: latest ?? current,
    };
  }

  const updated = await getMatch(matchId, creatorId);
  if (!updated) throw new Error("The updated match could not be read.");
  return { ok: true, match: updated };
}

function submissionHash(winnerCompetitorId: string, survivingPlayerIds: string[]): string {
  return JSON.stringify([winnerCompetitorId, [...survivingPlayerIds].sort()]);
}

async function findSubmission(
  matchId: string,
  submissionId: string,
): Promise<{ input_hash: string } | null> {
  return env.DB.prepare(
    `SELECT input_hash FROM rounds
     WHERE match_id = ? AND submission_id = ?`,
  )
    .bind(matchId, submissionId)
    .first<{ input_hash: string }>();
}

function isUniqueSubmissionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: rounds.match_id, rounds.submission_id")
  );
}

export async function submitRound(
  matchId: string,
  creatorId: string,
  input: {
    revision: number;
    submissionId: string;
    winnerCompetitorId: string;
    survivingPlayerIds: string[];
  },
): Promise<MatchMutation> {
  if (!(await isCreator(matchId, creatorId))) {
    return { ok: false, status: 404, error: "Match not found." };
  }

  const current = await getMatch(matchId, creatorId);
  if (!current) return { ok: false, status: 404, error: "Match not found." };

  const inputHash = submissionHash(input.winnerCompetitorId, input.survivingPlayerIds);
  const existing = await findSubmission(matchId, input.submissionId);
  if (existing) {
    if (existing.input_hash !== inputHash) {
      return {
        ok: false,
        status: 409,
        error: "This submission ID was already used for a different result.",
        match: current,
      };
    }
    return { ok: true, match: current, idempotent: true };
  }

  const now = new Date().toISOString();
  const scored = recordRound(
    toState(current),
    {
      id: crypto.randomUUID(),
      submissionId: input.submissionId,
      winnerCompetitorId: input.winnerCompetitorId,
      survivingPlayerIds: input.survivingPlayerIds,
    },
    input.revision,
    now,
  );

  if (!scored.ok) {
    const status = scored.error === "stale-match" ? 409 : 400;
    return {
      ok: false,
      status,
      error: `Round was not saved: ${scored.error}.`,
      match: current,
    };
  }

  const round = scored.round;
  if (!round) throw new Error("Scoring did not produce a round record.");

  const statements = [
    env.DB.prepare(
      `UPDATE matches
       SET revision = revision + 1, status = ?, completed_at = ?,
           winner_competitor_id = ?
       WHERE id = ? AND revision = ? AND status = 'active'`,
    ).bind(
      scored.match.status,
      scored.match.completedAt,
      scored.match.winnerCompetitorId,
      matchId,
      input.revision,
    ),
    env.DB.prepare(
      `INSERT INTO rounds
        (id, match_id, sequence, submission_id, input_hash,
         winner_competitor_id, survivor_count, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM matches WHERE id = ? AND revision = ?
       )`,
    ).bind(
      round.id,
      matchId,
      round.sequence,
      input.submissionId,
      inputHash,
      round.winnerCompetitorId,
      round.survivingPlayerIds.length,
      now,
      matchId,
      input.revision + 1,
    ),
    ...round.attributions.map((attribution) =>
      env.DB.prepare(
        `INSERT INTO point_attributions (round_id, player_id, points)
         SELECT ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM rounds WHERE id = ? AND match_id = ?
         )`,
      ).bind(round.id, attribution.playerId, attribution.points, round.id, matchId),
    ),
  ];

  try {
    const results = await env.DB.batch(statements);
    if (results[0]?.meta.changes !== 1) {
      const racedSubmission = await findSubmission(matchId, input.submissionId);
      const latest = await getMatch(matchId, creatorId);
      if (racedSubmission?.input_hash === inputHash && latest) {
        return { ok: true, match: latest, idempotent: true };
      }
      if (racedSubmission) {
        return {
          ok: false,
          status: 409,
          error: "This submission ID was already used for a different result.",
          match: latest ?? current,
        };
      }
      return {
        ok: false,
        status: 409,
        error: "The match changed. Refresh its current score before retrying.",
        match: latest ?? current,
      };
    }
  } catch (error) {
    if (!isUniqueSubmissionError(error)) throw error;
    const racedSubmission = await findSubmission(matchId, input.submissionId);
    const latest = await getMatch(matchId, creatorId);
    if (racedSubmission?.input_hash === inputHash && latest) {
      return { ok: true, match: latest, idempotent: true };
    }
    if (racedSubmission) {
      return {
        ok: false,
        status: 409,
        error: "This submission ID was already used for a different result.",
        match: latest ?? current,
      };
    }
    throw error;
  }

  const updated = await getMatch(matchId, creatorId);
  if (!updated) throw new Error("The saved match could not be read.");

  return { ok: true, match: updated };
}

export async function chooseMap(
  matchId: string,
  creatorId: string,
  mapId: string,
  revision: number,
): Promise<MatchMutation> {
  if (!(await isCreator(matchId, creatorId))) {
    return { ok: false, status: 404, error: "Match not found." };
  }
  if (!(await mapExists(mapId))) {
    return { ok: false, status: 400, error: "Choose a valid map." };
  }

  const current = await getMatch(matchId, creatorId);
  if (!current) return { ok: false, status: 404, error: "Match not found." };
  const now = new Date().toISOString();
  const result = selectMap(toState(current), mapId, now);
  if (!result.ok) {
    return {
      ok: false,
      status: 409,
      error: "This match is not editable.",
      match: current,
    };
  }

  const update = await env.DB.prepare(
    `UPDATE matches
     SET map_id = ?, revision = revision + 1, status = ?, completed_at = ?
     WHERE id = ? AND revision = ? AND status IN ('active', 'awaiting-map')`,
  )
    .bind(mapId, result.match.status, result.match.completedAt, matchId, revision)
    .run();

  if (update.meta.changes !== 1) {
    const latest = await getMatch(matchId, creatorId);
    return {
      ok: false,
      status: 409,
      error: "The match changed. Refresh its current state before retrying.",
      match: latest ?? current,
    };
  }

  const updated = await getMatch(matchId, creatorId);
  if (!updated) throw new Error("The updated match could not be read.");
  return { ok: true, match: updated };
}

export async function undoRound(
  matchId: string,
  creatorId: string,
  revision: number,
  reopenCompleted: boolean,
): Promise<MatchMutation> {
  if (!(await isCreator(matchId, creatorId))) {
    return { ok: false, status: 404, error: "Match not found." };
  }
  const current = await getMatch(matchId, creatorId);
  if (!current) return { ok: false, status: 404, error: "Match not found." };

  const correction = current.status === "completed" && reopenCompleted;
  const undone = undoLastRound(toState(current), {
    reopenCompleted: correction,
  });
  if (!undone.ok) {
    return {
      ok: false,
      status: undone.error === "correction-required" ? 409 : 400,
      error:
        undone.error === "correction-required"
          ? "Use the explicit correction action to reopen a completed match."
          : "There is no round to undo.",
      match: current,
    };
  }

  const lastRound = undone.match.rounds.find(
    (round: RoundResult) =>
      round.undone &&
      !current.rounds.find((previous) => previous.id === round.id && previous.undone),
  );
  if (!lastRound) throw new Error("Undo did not identify its round record.");

  const undoneAt = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE matches
       SET revision = revision + 1, status = 'active',
           completed_at = NULL, winner_competitor_id = NULL
       WHERE id = ? AND revision = ? AND status IN ('active', 'awaiting-map', 'completed')`,
    ).bind(matchId, revision),
    env.DB.prepare(
      `UPDATE rounds SET undone = 1
       WHERE id = ? AND match_id = ? AND undone = 0
         AND EXISTS (
           SELECT 1 FROM matches
           WHERE id = ? AND revision = ? AND status = 'active'
         )`,
    ).bind(lastRound.id, matchId, matchId, revision + 1),
    env.DB.prepare(
      `INSERT INTO round_undos (round_id, actor_id, undone_at, correction)
       SELECT ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM rounds WHERE id = ? AND match_id = ? AND undone = 1
       )`,
    ).bind(lastRound.id, creatorId, undoneAt, correction ? 1 : 0, lastRound.id, matchId),
  ]);

  if (
    results[0]?.meta.changes !== 1 ||
    results[1]?.meta.changes !== 1 ||
    results[2]?.meta.changes !== 1
  ) {
    const latest = await getMatch(matchId, creatorId);
    return {
      ok: false,
      status: 409,
      error: "The match changed. Refresh its current state before undoing.",
      match: latest ?? current,
    };
  }

  const updated = await getMatch(matchId, creatorId);
  if (!updated) throw new Error("The corrected match could not be read.");
  return { ok: true, match: updated };
}

export async function abandon(
  matchId: string,
  creatorId: string,
  revision: number,
): Promise<MatchMutation> {
  if (!(await isCreator(matchId, creatorId))) {
    return { ok: false, status: 404, error: "Match not found." };
  }
  const current = await getMatch(matchId, creatorId);
  if (!current) return { ok: false, status: 404, error: "Match not found." };
  const result = abandonMatch(toState(current));
  if (!result.ok) {
    return { ok: false, status: 409, error: "This match is not active." };
  }

  const abandonedAt = new Date().toISOString();
  const update = await env.DB.prepare(
    `UPDATE matches
     SET status = 'abandoned', abandoned_at = ?, revision = revision + 1
     WHERE id = ? AND revision = ? AND status IN ('active', 'awaiting-map')`,
  )
    .bind(abandonedAt, matchId, revision)
    .run();

  if (update.meta.changes !== 1) {
    const latest = await getMatch(matchId, creatorId);
    return {
      ok: false,
      status: 409,
      error: "The match changed. Refresh its current state before abandoning.",
      match: latest ?? current,
    };
  }

  const updated = await getMatch(matchId, creatorId);
  if (!updated) throw new Error("The abandoned match could not be read.");
  return { ok: true, match: updated };
}
