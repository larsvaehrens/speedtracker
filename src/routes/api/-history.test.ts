import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getRecentMatches: vi.fn(),
  get: async (_input: { request: Request }): Promise<Response> => {
    throw new Error("History handler has not been registered.");
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
}));
vi.mock("#/server/data", () => ({ getRecentMatches: mocks.getRecentMatches }));

import "./history";

describe("complete match history API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: "player" });
    mocks.getRecentMatches.mockResolvedValue([{ id: "older-match" }]);
  });

  it("returns the full history for the authenticated player", async () => {
    const response = await mocks.get({
      request: new Request("http://localhost/api/history"),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ matches: [{ id: "older-match" }] });
    expect(mocks.getRecentMatches).toHaveBeenCalledWith("player", null);
  });

  it("requires authentication before reading history", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const response = await mocks.get({
      request: new Request("http://localhost/api/history"),
    });
    expect(response.status).toBe(401);
    expect(mocks.getRecentMatches).not.toHaveBeenCalled();
  });
});
