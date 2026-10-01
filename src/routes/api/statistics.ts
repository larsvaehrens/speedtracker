import { createFileRoute } from "@tanstack/react-router";
import { calculateStatistics } from "#/domain/statistics";
import type { CompletedMatch, MatchState } from "#/domain/types";
import type { StatisticsPlayer } from "#/domain/views";
import { EMPTY_MATCH_FILTERS, isValidDateInput, type MatchFilters } from "#/domain/match-filters";
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
        const startDate = searchParams.get("startDate") ?? "";
        const endDate = searchParams.get("endDate") ?? "";
        if (
          (startDate && !isValidDateInput(startDate)) ||
          (endDate && !isValidDateInput(endDate)) ||
          (startDate && endDate && startDate > endDate)
        ) {
          return badRequest("Choose a valid date range.");
        }
        function selectedIds(key: string): string[] | null {
          const ids = [...new Set(searchParams.getAll(key).filter(Boolean))];
          return ids.length <= 100 ? ids : null;
        }
        const mapIds = selectedIds("mapId");
        const teammateIds = selectedIds("teammateId");
        const opponentIds = selectedIds("opponentId");
        if (!mapIds || !teammateIds || !opponentIds) {
          return badRequest("Too many filter selections.");
        }
        const filters: MatchFilters = {
          ...EMPTY_MATCH_FILTERS,
          startDate,
          endDate,
          mapIds,
          teammateIds,
          opponentIds,
        };

        const [matches, maps, players] = await Promise.all([
          getCompletedMatches(playerId),
          getMaps(),
          getCompletedMatchPlayers(playerId),
        ]);
        const completedMatches = matches.filter(isCompletedMatch);
        players[playerId] = { screenName: player.screenName, avatar: player.avatar };
        const teammateIdsAvailable = new Set<string>();
        const opponentIdsAvailable = new Set<string>();
        for (const match of completedMatches) {
          const ownCompetitor = match.competitors.find(({ playerIds }) =>
            playerIds.includes(playerId),
          );
          if (!ownCompetitor) continue;
          for (const id of ownCompetitor.playerIds) {
            if (id !== playerId) teammateIdsAvailable.add(id);
          }
          for (const competitor of match.competitors) {
            if (competitor.id !== ownCompetitor.id) {
              for (const id of competitor.playerIds) opponentIdsAvailable.add(id);
            }
          }
        }

        return json({
          statistics: calculateStatistics(playerId, completedMatches, maps, { timeZone, filters }),
          filterOptions: {
            maps: maps.map(({ id, name, imagePath }) => ({ id, label: name, imagePath })),
            teammates: [...teammateIdsAvailable].map((id) => ({
              id,
              label: players[id]?.screenName ?? "Player",
              avatar: players[id]?.avatar ?? null,
            })),
            opponents: [...opponentIdsAvailable].map((id) => ({
              id,
              label: players[id]?.screenName ?? "Player",
              avatar: players[id]?.avatar ?? null,
            })),
          },
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
