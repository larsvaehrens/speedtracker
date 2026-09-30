import { createFileRoute } from "@tanstack/react-router";
import { calculateStatistics } from "#/domain/statistics";
import type { CompletedMatch, MatchState } from "#/domain/types";
import type { StatisticsPlayer } from "#/domain/views";
import { badRequest, currentUser, json, unauthorized, unavailable } from "#/server/http";
import { getCompletedMatchPlayers, getCompletedMatches, getFollows, getMaps } from "#/server/data";

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

        const searchParams = new URL(request.url).searchParams;
        const playerId = searchParams.get("playerId") ?? user.id;
        let player: StatisticsPlayer = {
          id: user.id,
          screenName: user.name ?? "",
          avatar: user.image ?? null,
        };
        if (playerId !== user.id) {
          const followedPlayer = (await getFollows(user.id)).find(({ id }) => id === playerId);
          if (!followedPlayer) return unavailable();
          player = followedPlayer;
        }
        const timeZone = searchParams.get("timeZone") ?? "UTC";
        try {
          new Intl.DateTimeFormat("en-US", { timeZone });
        } catch (error) {
          if (error instanceof RangeError) return badRequest("Choose a valid time zone.");
          throw error;
        }

        const [matches, maps, players] = await Promise.all([
          getCompletedMatches(playerId),
          getMaps(),
          getCompletedMatchPlayers(playerId),
        ]);
        const completedMatches = matches.filter(isCompletedMatch);
        players[playerId] = { screenName: player.screenName, avatar: player.avatar };

        return json({
          statistics: calculateStatistics(playerId, completedMatches, maps, { timeZone }),
          player: { id: player.id, screenName: player.screenName, avatar: player.avatar },
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
