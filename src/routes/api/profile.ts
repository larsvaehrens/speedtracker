import { createFileRoute } from "@tanstack/react-router";
import { isHeroAvatar } from "#/domain/assets";
import { currentUser, json, requestBody, unauthorized } from "#/server/http";
import { env } from "cloudflare:workers";

function isScreenName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 24 &&
    !Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();
        const body = await requestBody(request);
        if (
          !body ||
          !isScreenName(body.screenName) ||
          (body.avatar !== null && (typeof body.avatar !== "string" || !isHeroAvatar(body.avatar)))
        ) {
          return json({ error: "Choose a screen name and a supplied hero avatar." }, 400);
        }

        const screenName = body.screenName.trim();
        await env.DB.prepare(`UPDATE user SET name = ?, image = ?, updatedAt = ? WHERE id = ?`)
          .bind(screenName, body.avatar, Date.now(), user.id)
          .run();

        return json({
          user: {
            id: user.id,
            username: user.username ?? "",
            screenName,
            avatar: body.avatar,
          },
        });
      },
    },
  },
});
