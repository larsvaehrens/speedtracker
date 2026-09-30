import { createFileRoute } from "@tanstack/react-router";
import { calculateStatistics } from "#/domain/statistics";
import type { CompletedMatch, MatchState } from "#/domain/types";
import { currentUser, json, unauthorized } from "#/server/http";
import { getCompletedMatchPlayers, getCompletedMatches, getMaps } from "#/server/data";

function isCompletedMatch(match: MatchState): match is CompletedMatch {
  return (
    match.status === "completed" &&
    match.mapId !== null &&
    match.completedAt !== null &&
    match.winnerCompetitorId !== null
  );
}

export const Route = createFileRoute("/api/statistics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();

        const [matches, maps, players] = await Promise.all([
          getCompletedMatches(user.id),
          getMaps(),
          getCompletedMatchPlayers(user.id),
        ]);
        const completedMatches = matches.filter(isCompletedMatch);
        players[user.id] = { screenName: user.name ?? "", avatar: user.image ?? null };

        return json({
          statistics: calculateStatistics(user.id, completedMatches, maps),
          playerNames: Object.fromEntries(
            Object.entries(players).map(([id, player]) => [id, player.screenName]),
          ),
          playerAvatars: Object.fromEntries(
            Object.entries(players).map(([id, player]) => [id, player.avatar]),
          ),
        });
      },
    },
  },
});
