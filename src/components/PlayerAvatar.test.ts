import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FriendView, MatchView } from "#/domain/views";
import { HistoryView } from "./HistoryView";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerSelect } from "./PlayerSelect";
import { SetupBuilder } from "./SetupBuilder";

const players: FriendView[] = [
  { id: "me", username: "myself", screenName: "Me", avatar: "/me.png", followedAt: null },
  {
    id: "friend",
    username: "friend",
    screenName: "Friend",
    avatar: "/friend.png",
    followedAt: "2026-09-01",
  },
  {
    id: "opponent",
    username: "opponent",
    screenName: "Opponent",
    avatar: null,
    followedAt: "2026-09-01",
  },
];
const match: MatchView = {
  id: "match",
  creatorId: "me",
  revision: 1,
  status: "completed",
  mapId: "map",
  map: { id: "map", name: "Casino", imagePath: "/map.png", order: 1 },
  startedAt: "2026-09-30T10:00:00Z",
  completedAt: "2026-09-30T10:05:00Z",
  durationSeconds: 300,
  winnerCompetitorId: "team",
  competitors: [
    {
      id: "team",
      kind: "team",
      sortOrder: 0,
      playerIds: ["me", "friend"],
      players: players.slice(0, 2),
      score: 4,
    },
    {
      id: "solo",
      kind: "solo",
      sortOrder: 1,
      playerIds: ["opponent"],
      players: players.slice(2),
      score: 0,
    },
  ],
  rounds: [
    {
      id: "round",
      submissionId: "submission",
      sequence: 1,
      winnerCompetitorId: "team",
      survivingPlayerIds: ["me", "friend"],
      attributions: [
        { playerId: "me", points: 1 },
        { playerId: "friend", points: 1 },
      ],
      undone: false,
    },
  ],
};

describe("player profile pictures", () => {
  it("uses the player's selected avatar and the existing default for missing avatars", () => {
    expect(renderToStaticMarkup(createElement(PlayerAvatar, { avatar: "/friend.png" }))).toContain(
      'src="/friend.png"',
    );
    const fallback = renderToStaticMarkup(createElement(PlayerAvatar, { avatar: null }));
    expect(fallback).toContain('src="/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"');
    expect(fallback).toContain('alt=""');
  });

  it("shows the selected player's avatar, username, and self indicator in the setup picker", () => {
    const markup = renderToStaticMarkup(
      createElement(PlayerSelect, {
        label: "Team member 1",
        players,
        value: "me",
        userId: "me",
        selectedPlayers: new Set(["me"]),
        onChange: () => {},
      }),
    );
    expect(markup).toContain('src="/me.png"');
    expect(markup).toContain("Me (@myself) · you");
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-expanded="false"');
  });

  it("shows a placeholder without an unrelated avatar for an empty setup slot", () => {
    const markup = renderToStaticMarkup(
      createElement(PlayerSelect, {
        label: "Player",
        players,
        value: "",
        userId: "me",
        selectedPlayers: new Set(["me"]),
        onChange: () => {},
      }),
    );
    expect(markup).toContain("Select a Player");
    expect(markup).not.toContain("<img");
  });

  it("shows all team and solo avatars in history, including round winners", () => {
    const markup = renderToStaticMarkup(
      createElement(HistoryView, {
        matches: [match],
        viewerId: "me",
        onOpen: () => {},
      }),
    );
    expect(markup.match(/<img /g)).toHaveLength(5);
    expect(markup).toContain('src="/me.png"');
    expect(markup).toContain('src="/friend.png"');
    expect(markup).toContain('src="/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"');
    expect(markup).toContain("1 round credits");
    expect(markup).toContain("Round breakdown");
  });

  it("includes each player's picture in open matches on the setup screen", () => {
    const markup = renderToStaticMarkup(
      createElement(SetupBuilder, {
        user: players[0],
        players,
        maps: [],
        openMatches: [{ ...match, status: "active" }],
        onResume: () => {},
        onMatchCreated: () => {},
      }),
    );
    expect(markup).toContain("Open Matches");
    expect(markup.match(/<img /g)).toHaveLength(4);
    expect(markup).toContain('src="/friend.png"');
  });
});
