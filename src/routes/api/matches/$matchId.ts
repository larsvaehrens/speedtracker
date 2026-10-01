import { createFileRoute } from "@tanstack/react-router";
import { getMatch } from "#/server/data";
import {
  badRequest,
  currentUser,
  json,
  requestBody,
  unauthorized,
  unavailable,
} from "#/server/http";
import { chooseMap } from "#/server/matches";

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

export const Route = createFileRoute("/api/matches/$matchId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const match = await getMatch(params.matchId, user.id);
        return match ? json({ match }) : unavailable();
      },
      PATCH: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (!body || typeof body.mapId !== "string" || !isRevision(body.revision)) {
          return badRequest("Choose a map to save.");
        }

        const result = await chooseMap(params.matchId, user.id, body.mapId, body.revision);
        if (!result.ok) {
          return result.status === 409
            ? json({ error: result.error, match: result.match }, result.status)
            : json({ error: result.error }, result.status);
        }
        return json({ match: result.match });
      },
    },
  },
});
