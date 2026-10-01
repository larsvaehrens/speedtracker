import { createFileRoute } from "@tanstack/react-router";
import { badRequest, currentUser, json, requestBody, unauthorized } from "#/server/http";
import { undoRound } from "#/server/matches";

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export const Route = createFileRoute("/api/matches/$matchId/undo")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (
          !body ||
          !isRevision(body.revision) ||
          (body.correction !== undefined && typeof body.correction !== "boolean")
        ) {
          return badRequest("Refresh the match before undoing a round.");
        }

        const result = await undoRound(
          params.matchId,
          user.id,
          body.revision,
          body.correction === true,
        );
        if (!result.ok) {
          return result.status === 409
            ? json({ error: result.error, match: result.match }, 409)
            : json({ error: result.error }, result.status);
        }
        return json({ match: result.match });
      },
    },
  },
});
