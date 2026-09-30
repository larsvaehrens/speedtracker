import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { currentUser, json, unauthorized } from "#/server/http";
import { getFollows } from "#/server/data";

export const Route = createFileRoute("/api/follows/$playerId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();

        await env.DB.prepare(`DELETE FROM follows WHERE follower_id = ? AND followed_id = ?`)
          .bind(user.id, params.playerId)
          .run();

        return json({ follows: await getFollows(user.id) });
      },
    },
  },
});
