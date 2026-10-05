import type { CompletedMatch } from "#/domain/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getCompletedMatches: vi.fn(),
  getMaps: vi.fn(),
  getCompletedMatchPlayers: vi.fn(),
  getFollows: vi.fn(),
  get: async (_input: { request: Request }): Promise<Response> => {
    throw new Error("Statistics handler has not been registered.");
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    (config: {
      server: { handlers: { GET: (input: { request: Request }) => Promise<Response> } };
    }) => {
      mocks.get = config.server.handlers.GET;
      return {};
    },
}));
vi.mock("#/server/http", () => ({
  currentUser: mocks.currentUser,
  json: (data: unknown, status = 200) => Response.json(data, { status }),
  unauthorized: () => Response.json({ error: "Sign in to continue." }, { status: 401 }),
  badRequest: (error: string) => Response.json({ error }, { status: 400 }),
  unavailable: () => Response.json({ error: "This resource is unavailable." }, { status: 404 }),
}));
vi.mock("#/server/data", () => ({
  getCompletedMatches: mocks.getCompletedMatches,
  getMaps: mocks.getMaps,
  getCompletedMatchPlayers: mocks.getCompletedMatchPlayers,
  getFollows: mocks.getFollows,
}));

import "./statistics";

describe("statistics timezone API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
    mocks.currentUser.mockResolvedValue({ id: "player", name: "Player", image: null });
    mocks.getMaps.mockResolvedValue([]);
    mocks.getCompletedMatchPlayers.mockResolvedValue({});
    mocks.getFollows.mockResolvedValue([]);
    const matches: CompletedMatch[] = ["2026-01-01T23:00:00Z", "2026-01-02T01:00:00Z"].map(
      (completedAt, index) => ({
        id: `match-${index}`,
        revision: 1,
        status: "completed",
        mapId: "map",
        startedAt: completedAt,
        completedAt,
        pausedAt: null,
        pausedDurationSeconds: 0,
        winnerCompetitorId: "own",
        gameModes: ["Sudden Death"],
        competitors: [
          { id: "own", playerIds: ["player"] },
          { id: "other", playerIds: ["opponent"] },
        ],
        rounds: [],
      }),
    );
    mocks.getCompletedMatches.mockResolvedValue(matches);
  });

  afterEach(() => vi.useRealTimers());

  it("uses the requested local timezone for daily streaks", async () => {
    const response = await mocks.get({
      request: new Request("http://localhost/api/statistics?timeZone=America%2FLos_Angeles"),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      statistics: { playingDayStreak: { current: 1, longest: 1 } },
    });
  });

  it("defaults older clients to UTC", async () => {
    const response = await mocks.get({ request: new Request("http://localhost/api/statistics") });
    expect(await response.json()).toMatchObject({
      statistics: {
        playingDayStreak: { current: 2, longest: 2 },
        monthlyComparison: {
          currentMonth: "January 2026",
          previousMonth: "December 2025",
          current: { matchesPlayed: 2, matchWinRate: 1 },
          previous: { matchesPlayed: 0, matchWinRate: null },
        },
      },
    });
  });

  it("includes each map's picture in the statistics response", async () => {
    mocks.getMaps.mockResolvedValue([
      { id: "map", name: "Casino", imagePath: "/resources/maps/12_Casino.png", order: 12 },
    ]);
    const response = await mocks.get({ request: new Request("http://localhost/api/statistics") });
    expect(await response.json()).toMatchObject({
      statistics: {
        maps: [{ mapId: "map", name: "Casino", imagePath: "/resources/maps/12_Casino.png" }],
      },
    });
  });

  it("returns a clear error for an invalid timezone", async () => {
    const response = await mocks.get({
      request: new Request("http://localhost/api/statistics?timeZone=not-a-zone"),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Choose a valid time zone." });
    expect(mocks.getCompletedMatches).not.toHaveBeenCalled();
  });

  it("applies date, map, teammate, and opponent selections to statistics", async () => {
    mocks.getMaps.mockResolvedValue([
      { id: "map", name: "Casino", imagePath: "/map.png", order: 0 },
    ]);
    const matches: CompletedMatch[] = [
      {
        id: "included",
        revision: 1,
        status: "completed",
        mapId: "map",
        startedAt: "2026-01-02T11:00:00Z",
        completedAt: "2026-01-02T12:00:00Z",
        pausedAt: null,
        pausedDurationSeconds: 0,
        winnerCompetitorId: "own",
        gameModes: ["Lethal Spikes"],
        competitors: [
          { id: "own", playerIds: ["player", "teammate"] },
          { id: "other", playerIds: ["opponent"] },
        ],
        rounds: [],
      },
      {
        id: "different-date",
        revision: 1,
        status: "completed",
        mapId: "map",
        startedAt: "2026-01-01T11:00:00Z",
        completedAt: "2026-01-01T12:00:00Z",
        pausedAt: null,
        pausedDurationSeconds: 0,
        winnerCompetitorId: "own",
        gameModes: ["Sudden Death"],
        competitors: [
          { id: "own", playerIds: ["player", "teammate"] },
          { id: "other", playerIds: ["opponent"] },
        ],
        rounds: [],
      },
    ];
    mocks.getCompletedMatches.mockResolvedValue(matches);
    mocks.getCompletedMatchPlayers.mockResolvedValue({
      player: { screenName: "Player", avatar: null },
      teammate: { screenName: "Teammate", avatar: null },
      opponent: { screenName: "Opponent", avatar: null },
    });
    const response = await mocks.get({
      request: new Request(
        "http://localhost/api/statistics?startDate=2026-01-02&endDate=2026-01-02&mapId=map&teammateId=teammate&opponentId=opponent&gameMode=Lethal%20Spikes",
      ),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      statistics: {
        matchesPlayed: 1,
        matchWins: 1,
        monthlyComparison: {
          current: { matchesPlayed: 1 },
          previous: { matchesPlayed: 0 },
        },
      },
      filterOptions: {
        maps: [{ id: "map", label: "Casino", imagePath: "/map.png" }],
        teammates: [{ id: "teammate", label: "Teammate" }],
        opponents: [{ id: "opponent", label: "Opponent" }],
      },
    });
  });

  it.each(["startDate=2026-02-30", "startDate=2026-01-03&endDate=2026-01-02"])(
    "rejects invalid filter date ranges: %s",
    async (query) => {
      const response = await mocks.get({
        request: new Request(`http://localhost/api/statistics?${query}`),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Choose a valid date range." });
      expect(mocks.getCompletedMatches).not.toHaveBeenCalled();
    },
  );

  it("requires authentication before reading statistics", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const response = await mocks.get({ request: new Request("http://localhost/api/statistics") });
    expect(response.status).toBe(401);
    expect(mocks.getCompletedMatches).not.toHaveBeenCalled();
    expect(mocks.getFollows).not.toHaveBeenCalled();
  });

  it("allows a followed player's full statistics without exposing match records", async () => {
    mocks.getFollows.mockResolvedValue([
      {
        id: "followed",
        screenName: "Followed player",
        username: "followed",
        avatar: "/followed.png",
        followedAt: "2026-01-01",
      },
    ]);
    const match: CompletedMatch = {
      id: "private-match",
      revision: 1,
      status: "completed",
      mapId: "map",
      startedAt: "2026-01-01T12:00:00Z",
      completedAt: "2026-01-01T12:05:00Z",
      pausedAt: null,
      pausedDurationSeconds: 0,
      winnerCompetitorId: "followed-competitor",
      gameModes: ["Sudden Death"],
      competitors: [
        { id: "followed-competitor", playerIds: ["followed"] },
        { id: "opposition", playerIds: ["other"] },
      ],
      rounds: [],
    };
    mocks.getCompletedMatches.mockResolvedValue([match]);
    const response = await mocks.get({
      request: new Request("http://localhost/api/statistics?playerId=followed"),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).not.toHaveProperty("matches");
    expect(payload).not.toHaveProperty("rounds");
    expect(payload).toMatchObject({
      player: { id: "followed", screenName: "Followed player", avatar: "/followed.png" },
      statistics: { matchesPlayed: 1, matchWins: 1, totalPlayedSeconds: 300 },
      playerNames: { followed: "Followed player" },
      playerAvatars: { followed: "/followed.png" },
    });
    expect(mocks.getFollows).toHaveBeenCalledWith("player");
    expect(mocks.getCompletedMatches).toHaveBeenCalledWith("followed");
    expect(mocks.getCompletedMatchPlayers).toHaveBeenCalledWith("followed");
  });

  it.each(["stranger", "former-follow", ""])("rejects unfollowed targets: %s", async (playerId) => {
    const response = await mocks.get({
      request: new Request(`http://localhost/api/statistics?playerId=${playerId}`),
    });
    expect(response.status).toBe(404);
    expect(mocks.getCompletedMatches).not.toHaveBeenCalled();
    expect(mocks.getCompletedMatchPlayers).not.toHaveBeenCalled();
    expect(mocks.getMaps).not.toHaveBeenCalled();
  });

  it("allows an explicit self target without requiring a self-follow", async () => {
    const response = await mocks.get({
      request: new Request("http://localhost/api/statistics?playerId=player"),
    });
    expect(response.status).toBe(200);
    expect(mocks.getFollows).not.toHaveBeenCalled();
    expect(mocks.getCompletedMatches).toHaveBeenCalledWith("player");
  });
});
