import { createFileRoute } from "@tanstack/react-router";
import { currentUser, json, unauthorized } from "#/server/http";
import { getRecentMatches } from "#/server/data";

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const matches = await getRecentMatches(user.id, null);
        return json({ matches });
      },
    },
  },
});
