import { createFileRoute } from "@tanstack/react-router";
import { badRequest, currentUser, json, requestBody, unauthorized } from "#/server/http";
import { submitRound } from "#/server/matches";

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSubmissionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 80 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export const Route = createFileRoute("/api/matches/$matchId/rounds")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (
          !body ||
          !isRevision(body.revision) ||
          !isSubmissionId(body.submissionId) ||
          typeof body.winnerCompetitorId !== "string" ||
          !isStringArray(body.survivingPlayerIds)
        ) {
          return badRequest("The Round result is incomplete.");
        }

        const result = await submitRound(params.matchId, user.id, {
          revision: body.revision,
          submissionId: body.submissionId,
          winnerCompetitorId: body.winnerCompetitorId,
          survivingPlayerIds: body.survivingPlayerIds,
        });
        if (!result.ok) {
          return result.status === 409
            ? json({ error: result.error, match: result.match }, result.status)
            : json({ error: result.error }, result.status);
        }
        return json({ match: result.match, idempotent: result.idempotent });
      },
    },
  },
});
