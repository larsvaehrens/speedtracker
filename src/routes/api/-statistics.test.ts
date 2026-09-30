import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompletedMatch } from "#/domain/types";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getCompletedMatches: vi.fn(),
  getMaps: vi.fn(),
  getCompletedMatchPlayers: vi.fn(),
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
}));
vi.mock("#/server/data", () => ({
  getCompletedMatches: mocks.getCompletedMatches,
  getMaps: mocks.getMaps,
  getCompletedMatchPlayers: mocks.getCompletedMatchPlayers,
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
    const matches: CompletedMatch[] = ["2026-01-01T23:00:00Z", "2026-01-02T01:00:00Z"].map(
      (completedAt, index) => ({
        id: `match-${index}`,
        revision: 1,
        status: "completed",
        mapId: "map",
        startedAt: completedAt,
        completedAt,
        winnerCompetitorId: "own",
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
      statistics: { playingDayStreak: { current: 2, longest: 2 } },
    });
  });

  it("includes each map's picture in the statistics response", async () => {
    mocks.getMaps.mockResolvedValue([
      { id: "map", name: "Casino", imagePath: "/ressources/maps/12_Casion.png", order: 12 },
    ]);
    const response = await mocks.get({ request: new Request("http://localhost/api/statistics") });
    expect(await response.json()).toMatchObject({
      statistics: {
        maps: [{ mapId: "map", name: "Casino", imagePath: "/ressources/maps/12_Casion.png" }],
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

  it("requires authentication before reading statistics", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const response = await mocks.get({ request: new Request("http://localhost/api/statistics") });
    expect(response.status).toBe(401);
    expect(mocks.getCompletedMatches).not.toHaveBeenCalled();
  });
});
