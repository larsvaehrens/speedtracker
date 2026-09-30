import { createFileRoute } from "@tanstack/react-router";
import { calculateStatistics } from "#/domain/statistics";
import type { CompletedMatch, MatchState } from "#/domain/types";
import { currentUser, json, unauthorized } from "#/server/http";
import { getCompletedMatchPlayerNames, getCompletedMatches, getMaps } from "#/server/data";

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

        const [matches, maps, playerNames] = await Promise.all([
          getCompletedMatches(user.id),
          getMaps(),
          getCompletedMatchPlayerNames(user.id),
        ]);
        const completedMatches = matches.filter(isCompletedMatch);
        playerNames[user.id] = user.name ?? "";

        return json({
          statistics: calculateStatistics(user.id, completedMatches, maps),
          playerNames,
        });
      },
    },
  },
});
