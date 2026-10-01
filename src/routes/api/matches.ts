import { createFileRoute } from "@tanstack/react-router";
import { getRecentMatches } from "#/server/data";
import { badRequest, currentUser, json, requestBody, unauthorized } from "#/server/http";
import { createMatch } from "#/server/matches";
import type { CompetitorSetup } from "#/domain/setup";
import { DEFAULT_GAME_MODES, isGameModes } from "#/domain/game-modes";

function isCompetitorSetup(value: unknown): value is CompetitorSetup[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (competitor) =>
        typeof competitor === "object" &&
        competitor !== null &&
        "playerIds" in competitor &&
        Array.isArray(competitor.playerIds) &&
        competitor.playerIds.every((playerId: unknown) => typeof playerId === "string"),
    )
  );
}

export const Route = createFileRoute("/api/matches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        return json({ matches: await getRecentMatches(user.id) });
      },
      POST: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (!body || !isCompetitorSetup(body.competitors)) {
          return badRequest("Select players and assign them to competitors.");
        }

        const mapId =
          body.mapId === null || body.mapId === undefined
            ? null
            : typeof body.mapId === "string"
              ? body.mapId
              : undefined;
        if (mapId === undefined) return badRequest("Choose a valid map.");
        const gameModes = body.gameModes === undefined ? DEFAULT_GAME_MODES : body.gameModes;
        if (!isGameModes(gameModes)) return badRequest("Choose valid game modes.");

        const result = await createMatch(user.id, body.competitors, mapId, gameModes);
        if (!result.ok) return json({ error: result.error }, result.status);
        return json({ match: result.match }, 201);
      },
    },
  },
});
