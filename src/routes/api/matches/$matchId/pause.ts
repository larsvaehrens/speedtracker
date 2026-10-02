import { createFileRoute } from "@tanstack/react-router";
import { badRequest, currentUser, json, requestBody, unauthorized } from "#/server/http";
import { setMatchPaused } from "#/server/matches";

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export const Route = createFileRoute("/api/matches/$matchId/pause")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (!body || typeof body.paused !== "boolean" || !isRevision(body.revision)) {
          return badRequest("Choose whether to pause or resume this match.");
        }

        const result = await setMatchPaused(params.matchId, user.id, body.revision, body.paused);
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
