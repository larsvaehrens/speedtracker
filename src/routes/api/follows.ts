import { createFileRoute } from "@tanstack/react-router";
import { validateUsername } from "#/domain/identity";
import { env } from "cloudflare:workers";
import { currentUser, json, requestBody, unauthorized } from "#/server/http";
import { getFollows } from "#/server/data";

export const Route = createFileRoute("/api/follows")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        return json({ follows: await getFollows(user.id) });
      },
      POST: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (!body || typeof body.username !== "string" || !validateUsername(body.username)) {
          return json(
            { error: "Enter the exact login username (3–24 letters, numbers, or underscores)." },
            400,
          );
        }

        const followed = await env.DB.prepare(
          `SELECT id FROM user WHERE username = ? COLLATE NOCASE`,
        )
          .bind(body.username)
          .first<{ id: string }>();

        if (!followed) {
          return json({ error: "No Player has that login username." }, 404);
        }
        if (followed.id === user.id) {
          return json({ error: "You already have yourself in your Setup." }, 400);
        }

        await env.DB.prepare(
          `INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at)
           VALUES (?, ?, ?)`,
        )
          .bind(user.id, followed.id, new Date().toISOString())
          .run();

        return json({ follows: await getFollows(user.id) });
      },
    },
  },
});
