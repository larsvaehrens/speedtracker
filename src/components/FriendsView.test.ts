import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { FriendsView } from "./FriendsView";
import { ToastProvider } from "./ToastProvider";

describe("followed player statistics links", () => {
  it("renders the avatar and name as a keyboard-accessible statistics button separate from Unfollow", () => {
    const markup = renderToStaticMarkup(
      createElement(ToastProvider, {
        children: createElement(FriendsView, {
          friends: [
            {
              id: "friend",
              username: "friend",
              screenName: "Friend",
              avatar: "/friend.png",
              followedAt: "2026-01-01",
            },
          ],
          recommendations: [],
          onChanged: () => {},
          onViewStatistics: () => {},
        }),
      }),
    );
    expect(markup).toContain('aria-label="View Friend&#x27;s statistics"');
    expect(markup).toContain('class="friend-profile"');
    expect(markup).toContain('src="/friend.png"');
    expect(markup).toContain("@friend");
    expect(markup.match(/<button /g)).toHaveLength(3);
    expect(markup).toContain("Unfollow");
  });

  it("renders recommended players with a mutual friend count and an Add button", () => {
    const markup = renderToStaticMarkup(
      createElement(ToastProvider, {
        children: createElement(FriendsView, {
          friends: [],
          recommendations: [
            { id: "rec", username: "rec", screenName: "Rec", avatar: null, mutualCount: 2 },
          ],
          onChanged: () => {},
          onViewStatistics: () => {},
        }),
      }),
    );
    expect(markup).toContain("Recommended players");
    expect(markup).toContain("2 mutual friends");
    expect(markup).toContain("Add</button>");
  });
});
