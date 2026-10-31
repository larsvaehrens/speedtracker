import { createFileRoute } from "@tanstack/react-router";
import { currentUser, json, unauthorized } from "#/server/http";
import {
  getEligiblePlayers,
  getMaps,
  getOpenMatches,
  getRecentMatches,
  getRecommendedFriends,
} from "#/server/data";

export const Route = createFileRoute("/api/bootstrap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return unauthorized();

        const [players, recommendations, maps, openMatches, recentMatches] = await Promise.all([
          getEligiblePlayers(user.id),
          getRecommendedFriends(user.id),
          getMaps(),
          getOpenMatches(user.id),
          getRecentMatches(user.id, 30),
        ]);

        return json({
          user: {
            id: user.id,
            username: user.username ?? "",
            screenName: user.name,
            avatar: user.image ?? null,
          },
          players,
          recommendations,
          maps,
          openMatches,
          recentMatches,
        });
      },
    },
  },
});
