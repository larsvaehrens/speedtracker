import { env } from "cloudflare:workers";
import { canViewMatch } from "#/domain/permissions";
import type { FriendView, MapView, MatchView, PlayerView } from "#/domain/views";
import type { MatchStatus, PointAttribution } from "#/domain/types";
import { getCompetitorScore } from "#/domain/scoring";
import type { MatchState } from "#/domain/types";

type MatchRow = {
  id: string;
  creator_id: string;
  map_id: string | null;
  map_name: string | null;
  map_image_path: string | null;
  map_sort_order: number | null;
  participant_access: number;
  status: MatchStatus;
  revision: number;
  winner_competitor_id: string | null;
  started_at: string;
  completed_at: string | null;
};

type CompetitorRow = {
  id: string;
  kind: "solo" | "team";
  sort_order: number;
  player_id: string;
  username: string;
  screen_name: string;
  avatar: string | null;
};

type ScoreRow = {
  competitor_id: string;
  score: number;
};

type RoundRow = {
  id: string;
  submission_id: string;
  sequence: number;
  winner_competitor_id: string;
  undone: number;
  player_id: string | null;
  points: number | null;
};

type MatchListRow = {
  id: string;
};

type PlayerNameRow = {
  id: string;
  screen_name: string;
  avatar: string | null;
};

type EligiblePlayerRow = PlayerView & {
  screen_name: string;
  followed_at: string | null;
  recent_at: string | null;
};

export async function getMaps(): Promise<MapView[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, sort_order AS "order", image_path AS imagePath
     FROM maps ORDER BY sort_order`,
  ).all<MapView>();

  return results;
}

export async function getMatch(matchId: string, viewerId: string): Promise<MatchView | null> {
  const match = await env.DB.prepare(
    `SELECT m.id, m.creator_id, m.map_id, m.status, m.revision,
            m.winner_competitor_id, m.started_at, m.completed_at,
            p.name AS map_name, p.image_path AS map_image_path,
            p.sort_order AS map_sort_order,
            EXISTS (
              SELECT 1 FROM competitor_members cm
              WHERE cm.match_id = m.id AND cm.player_id = ?
            ) AS participant_access
     FROM matches m
     LEFT JOIN maps p ON p.id = m.map_id
     WHERE m.id = ?`,
  )
    .bind(viewerId, matchId)
    .first<MatchRow>();

  if (!match || !canViewMatch(match.creator_id, match.participant_access === 1, viewerId)) {
    return null;
  }

  const competitorResult = await env.DB.prepare(
    `SELECT c.id, c.kind, c.sort_order, u.id AS player_id,
            u.username, u.name AS screen_name, u.image AS avatar
     FROM competitors c
     JOIN competitor_members cm
       ON cm.match_id = c.match_id AND cm.competitor_id = c.id
     JOIN user u ON u.id = cm.player_id
     WHERE c.match_id = ?
     ORDER BY c.sort_order, cm.sort_order`,
  )
    .bind(matchId)
    .all<CompetitorRow>();

  const competitorMap = new Map<
    string,
    {
      id: string;
      kind: "solo" | "team";
      sortOrder: number;
      playerIds: string[];
      players: PlayerView[];
      score: number;
    }
  >();

  for (const row of competitorResult.results) {
    const competitor = competitorMap.get(row.id) ?? {
      id: row.id,
      kind: row.kind,
      sortOrder: row.sort_order,
      playerIds: [],
      players: [],
      score: 0,
    };
    competitor.playerIds.push(row.player_id);
    competitor.players.push({
      id: row.player_id,
      username: row.username,
      screenName: row.screen_name,
      avatar: row.avatar,
    });
    competitorMap.set(row.id, competitor);
  }

  const scoreResult = await env.DB.prepare(
    `SELECT cm.competitor_id, COALESCE(SUM(pa.points), 0) AS score
     FROM competitor_members cm
     LEFT JOIN rounds r ON r.match_id = cm.match_id AND r.undone = 0
     LEFT JOIN point_attributions pa
       ON pa.round_id = r.id AND pa.player_id = cm.player_id
     WHERE cm.match_id = ?
     GROUP BY cm.competitor_id`,
  )
    .bind(matchId)
    .all<ScoreRow>();

  for (const row of scoreResult.results) {
    const competitor = competitorMap.get(row.competitor_id);
    if (competitor) competitor.score = row.score;
  }

  const roundResult = await env.DB.prepare(
    `SELECT r.id, r.submission_id, r.sequence, r.winner_competitor_id,
            r.undone, pa.player_id, pa.points
     FROM rounds r
     LEFT JOIN point_attributions pa ON pa.round_id = r.id
     WHERE r.match_id = ?
     ORDER BY r.sequence, pa.player_id`,
  )
    .bind(matchId)
    .all<RoundRow>();

  const roundMap = new Map<
    string,
    {
      id: string;
      submissionId: string;
      sequence: number;
      winnerCompetitorId: string;
      survivingPlayerIds: string[];
      attributions: PointAttribution[];
      undone: boolean;
    }
  >();

  for (const row of roundResult.results) {
    const round = roundMap.get(row.id) ?? {
      id: row.id,
      submissionId: row.submission_id,
      sequence: row.sequence,
      winnerCompetitorId: row.winner_competitor_id,
      survivingPlayerIds: [],
      attributions: [],
      undone: row.undone === 1,
    };
    if (row.player_id !== null && row.points !== null) {
      round.survivingPlayerIds.push(row.player_id);
      round.attributions.push({ playerId: row.player_id, points: row.points });
    }
    roundMap.set(row.id, round);
  }

  const competitors = [...competitorMap.values()];
  const rounds = [...roundMap.values()];
  const state: MatchState = {
    id: match.id,
    revision: match.revision,
    status: match.status,
    mapId: match.map_id,
    startedAt: match.started_at,
    completedAt: match.completed_at,
    winnerCompetitorId: match.winner_competitor_id,
    competitors: competitors.map(({ id, playerIds }) => ({ id, playerIds })),
    rounds,
  };

  const durationSeconds = match.completed_at
    ? Math.max(
        0,
        Math.floor((Date.parse(match.completed_at) - Date.parse(match.started_at)) / 1000),
      )
    : null;

  return {
    ...state,
    creatorId: match.creator_id,
    map:
      match.map_id && match.map_name && match.map_image_path && match.map_sort_order !== null
        ? {
            id: match.map_id,
            name: match.map_name,
            imagePath: match.map_image_path,
            order: match.map_sort_order,
          }
        : null,
    competitors: competitors.map((competitor) => ({
      ...competitor,
      score: getCompetitorScore(state, competitor.id),
    })),
    rounds,
    durationSeconds,
  };
}

export async function getEligiblePlayers(currentPlayerId: string): Promise<FriendView[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.name AS screen_name, u.image AS avatar,
            f.created_at AS followed_at, MAX(m.started_at) AS recent_at
     FROM user u
     LEFT JOIN follows f
       ON f.followed_id = u.id AND f.follower_id = ?
     LEFT JOIN competitor_members cm ON cm.player_id = u.id
     LEFT JOIN matches m
       ON m.id = cm.match_id AND m.status <> 'abandoned'
     LEFT JOIN competitor_members viewer
       ON viewer.match_id = m.id AND viewer.player_id = ?
     WHERE u.id = ? OR f.follower_id = ?
     GROUP BY u.id, f.created_at
     ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END,
              COALESCE(MAX(CASE WHEN viewer.player_id IS NOT NULL THEN m.started_at END), '') DESC,
              u.username COLLATE NOCASE`,
  )
    .bind(currentPlayerId, currentPlayerId, currentPlayerId, currentPlayerId, currentPlayerId)
    .all<EligiblePlayerRow>();

  return results.map((row) => ({
    id: row.id,
    username: row.username,
    screenName: row.screen_name,
    avatar: row.avatar,
    followedAt: row.followed_at,
  }));
}

export async function getFollows(currentPlayerId: string): Promise<FriendView[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.name AS screen_name, u.image AS avatar,
            f.created_at AS followed_at
     FROM follows f
     JOIN user u ON u.id = f.followed_id
     WHERE f.follower_id = ?
     ORDER BY u.username COLLATE NOCASE`,
  )
    .bind(currentPlayerId)
    .all<{
      id: string;
      username: string;
      screen_name: string;
      avatar: string | null;
      followed_at: string;
    }>();

  return results.map((row) => ({
    id: row.id,
    username: row.username,
    screenName: row.screen_name,
    avatar: row.avatar,
    followedAt: row.followed_at,
  }));
}

export async function getRecentMatches(
  playerId: string,
  limit: number | null = 30,
): Promise<MatchView[]> {
  const query = `SELECT m.id
    FROM matches m
    WHERE m.status = 'completed'
      AND EXISTS (
        SELECT 1 FROM competitor_members cm
        WHERE cm.match_id = m.id AND cm.player_id = ?
      )
    ORDER BY m.completed_at DESC, m.id${limit === null ? "" : "\n    LIMIT ?"}`;
  const statement = env.DB.prepare(query);
  const { results } =
    limit === null
      ? await statement.bind(playerId).all<MatchListRow>()
      : await statement.bind(playerId, limit).all<MatchListRow>();

  const matches: MatchView[] = [];
  for (const row of results) {
    const match = await getMatch(row.id, playerId);
    if (match) matches.push(match);
  }

  return matches;
}

export async function getOpenMatches(playerId: string): Promise<MatchView[]> {
  const { results } = await env.DB.prepare(
    `SELECT m.id FROM matches m
     WHERE m.status IN ('active', 'awaiting-map')
       AND (
         m.creator_id = ?
         OR EXISTS (
           SELECT 1 FROM competitor_members cm
           WHERE cm.match_id = m.id AND cm.player_id = ?
         )
       )
     ORDER BY started_at DESC, id`,
  )
    .bind(playerId, playerId)
    .all<MatchListRow>();

  const matches: MatchView[] = [];
  for (const row of results) {
    const match = await getMatch(row.id, playerId);
    if (match) matches.push(match);
  }

  return matches;
}

export async function getCompletedMatches(playerId: string): Promise<MatchState[]> {
  const { results } = await env.DB.prepare(
    `SELECT m.id
     FROM matches m
     WHERE m.status = 'completed'
       AND EXISTS (
         SELECT 1 FROM competitor_members cm
         WHERE cm.match_id = m.id AND cm.player_id = ?
       )
     ORDER BY m.completed_at, m.id`,
  )
    .bind(playerId)
    .all<MatchListRow>();

  const matches: MatchState[] = [];
  for (const row of results) {
    const match = await getMatch(row.id, playerId);
    if (match) {
      matches.push({
        id: match.id,
        revision: match.revision,
        status: match.status,
        mapId: match.mapId,
        startedAt: match.startedAt,
        completedAt: match.completedAt,
        winnerCompetitorId: match.winnerCompetitorId,
        competitors: match.competitors.map(({ id, playerIds }) => ({
          id,
          playerIds,
        })),
        rounds: match.rounds,
      });
    }
  }

  return matches;
}

export async function getCompletedMatchPlayers(
  playerId: string,
): Promise<Record<string, Pick<PlayerView, "screenName" | "avatar">>> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT participant.id, participant.name AS screen_name, participant.image AS avatar
     FROM matches m
     JOIN competitor_members member ON member.match_id = m.id
     JOIN user participant ON participant.id = member.player_id
     WHERE m.status = 'completed'
       AND EXISTS (
         SELECT 1 FROM competitor_members viewer
         WHERE viewer.match_id = m.id AND viewer.player_id = ?
       )`,
  )
    .bind(playerId)
    .all<PlayerNameRow>();

  return Object.fromEntries(
    results.map((player) => [player.id, { screenName: player.screen_name, avatar: player.avatar }]),
  );
}

export function setupEligibility(playerId: string, players: FriendView[]): ReadonlySet<string> {
  return new Set(
    players
      .filter((player) => player.id === playerId || player.followedAt !== null)
      .map((player) => player.id),
  );
}
