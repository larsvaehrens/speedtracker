import { createFileRoute } from "@tanstack/react-router";
import { badRequest, conflict, currentUser, json, requestBody, unauthorized } from "#/server/http";
import { abandon } from "#/server/matches";

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export const Route = createFileRoute("/api/matches/$matchId/abandon")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (!body || !isRevision(body.revision)) {
          return badRequest("Refresh the Match before abandoning it.");
        }

        const result = await abandon(params.matchId, user.id, body.revision);
        if (!result.ok) {
          return result.status === 409
            ? conflict(result.error)
            : json({ error: result.error }, result.status);
        }
        return json({ match: result.match });
      },
    },
  },
});
