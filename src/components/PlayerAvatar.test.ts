import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FriendView, MatchView } from "#/domain/views";
import { HistoryView } from "./HistoryView";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerSelect } from "./PlayerSelect";
import { SetupBuilder } from "./SetupBuilder";
import { ToastProvider } from "./ToastProvider";
import { MatchBoard } from "./MatchBoard";
import { MatchCompetitors } from "./MatchCompetitors";

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
  gameModes: ["Sudden Death"],
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
    expect(markup).toContain('class="icon player-select-arrow"');
    expect(markup).not.toContain("▾");
  });

  describe("match navigation icons", () => {
    it("uses SVG icons while preserving the back button and connection status labels", () => {
      const markup = renderToStaticMarkup(
        createElement(MatchBoard, {
          initialMatch: match,
          maps: [],
          viewerId: "me",
          onMatchChanged: () => {},
          onDone: () => {},
        }),
      );
      expect(markup).toContain("Matches</button>");
      expect(markup).toContain("All changes saved");
      expect(markup).toContain('fill="currentColor" r="8" stroke="none"');
      expect(markup).not.toContain("←");
      expect(markup).not.toContain("●");
    });
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
        matches: [{ ...match, gameModes: ["Sudden Death", "Lethal Spikes"] }],
        viewerId: "me",
        onOpen: () => {},
      }),
    );
    expect(markup.match(/class="player-avatar"/g)).toHaveLength(7);
    expect(markup).toContain('src="/map.png"');
    expect(markup).toContain('src="/me.png"');
    expect(markup).toContain('src="/friend.png"');
    expect(markup).toContain('src="/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"');
    expect(markup).toContain("1 round credits");
    expect(markup).toContain("Sudden Death");
    expect(markup).toContain("Lethal Spikes");
    expect(markup).toContain('aria-label="Enabled game modes"');
    expect(markup).toContain("Round breakdown");
  });

  it("defaults new matches to Sudden Death and exposes all game modes", () => {
    const markup = renderToStaticMarkup(
      createElement(ToastProvider, {
        children: createElement(SetupBuilder, {
          user: players[0],
          players,
          maps: [],
          openMatches: [],
          onResume: () => {},
          onMatchCreated: () => {},
        }),
      }),
    );
    expect(markup.match(/checked=""/g)).toHaveLength(1);
    expect(markup).toContain("Sudden Death");
    expect(markup).toContain("Lethal Spikes");
    expect(markup).toContain("srennuRdeepS");
    expect(markup).toContain("SuperSpeedRunners");
    expect(markup).toContain("SpeedRapture");
    expect(markup).toContain("Destructible Environment");
  });

  it("keeps the missing map label without rendering a broken thumbnail", () => {
    const markup = renderToStaticMarkup(
      createElement(HistoryView, {
        matches: [{ ...match, map: null }],
        viewerId: "me",
        onOpen: () => {},
      }),
    );
    expect(markup).toContain("Map missing");
    expect(markup).not.toContain('class="map-thumbnail"');
  });

  it("includes each player's picture in open matches on the setup screen", () => {
    const markup = renderToStaticMarkup(
      createElement(ToastProvider, {
        children: createElement(SetupBuilder, {
          user: players[0],
          players,
          maps: [],
          openMatches: [
            {
              ...match,
              status: "active",
              completedAt: null,
              durationSeconds: null,
              winnerCompetitorId: null,
              competitors: match.competitors.map((competitor) => ({
                ...competitor,
                score: competitor.kind === "team" ? 2 : 0,
              })),
            },
          ],
          onResume: () => {},
          onMatchCreated: () => {},
        }),
      }),
    );
    expect(markup).toContain('class="open-match-list"');
    expect(markup.match(/class="player-avatar"/g)).toHaveLength(4);
    expect(markup).toContain('src="/friend.png"');
    expect(markup).toContain('class="open-match-card history-card panel"');
    expect(markup).toContain('src="/map.png"');
    expect(markup).toContain('class="history-competitors"');
    expect(markup.match(/class="history-competitor"/g)).toHaveLength(2);
    expect(markup).toContain("<strong>2</strong>");
    expect(markup).toContain("<strong>0</strong>");
    expect(markup).toContain("Sudden Death");
    expect(markup).toContain("1 round credits");
    expect(markup).not.toContain("Round breakdown");
    expect(markup).not.toContain("View match");
  });

  it("keeps matches awaiting a map visible without a broken map image", () => {
    const markup = renderToStaticMarkup(
      createElement(ToastProvider, {
        children: createElement(SetupBuilder, {
          user: players[0],
          players,
          maps: [],
          openMatches: [
            {
              ...match,
              status: "awaiting-map",
              map: null,
              mapId: null,
              winnerCompetitorId: null,
            },
          ],
          onResume: () => {},
          onMatchCreated: () => {},
        }),
      }),
    );
    expect(markup).toContain("Map needed");
    expect(markup).toContain("Map not selected");
    expect(markup).not.toContain('class="map-thumbnail"');
    expect(markup).toContain('class="history-competitors"');
    expect(markup).not.toContain('class="history-competitor is-winner"');
  });

  it("preserves winner highlighting and excludes undone rounds in shared competitor cards", () => {
    const markup = renderToStaticMarkup(
      createElement(MatchCompetitors, {
        match: {
          ...match,
          rounds: [...match.rounds, { ...match.rounds[0], id: "undone-round", undone: true }],
        },
      }),
    );
    expect(markup).toContain('class="history-competitor is-winner"');
    expect(markup.match(/1 round credits/g)).toHaveLength(2);
    expect(markup).toContain("0 round credits");
    expect(markup).toContain("<strong>4</strong>");
    expect(markup).not.toContain("2 round credits");
    expect(markup).not.toContain("<div");
    expect(markup).not.toContain("<button");
  });
});
