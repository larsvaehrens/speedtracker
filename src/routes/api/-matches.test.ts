import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getRecentMatches: vi.fn(),
  createMatch: vi.fn(),
  get: async (_input: { request: Request }): Promise<Response> => {
    throw new Error("Matches handler has not been registered.");
  },
  post: async (_input: { request: Request }): Promise<Response> => {
    throw new Error("Matches handler has not been registered.");
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    (config: {
      server: {
        handlers: {
          GET: (input: { request: Request }) => Promise<Response>;
          POST: (input: { request: Request }) => Promise<Response>;
        };
      };
    }) => {
      mocks.get = config.server.handlers.GET;
      mocks.post = config.server.handlers.POST;
      return {};
    },
}));
vi.mock("#/server/http", () => ({
  currentUser: mocks.currentUser,
  json: (data: unknown, status = 200) => Response.json(data, { status }),
  unauthorized: () => Response.json({ error: "Sign in to continue." }, { status: 401 }),
  badRequest: (error: string) => Response.json({ error }, { status: 400 }),
  requestBody: async (request: Request) => request.json(),
}));
vi.mock("#/server/data", () => ({ getRecentMatches: mocks.getRecentMatches }));
vi.mock("#/server/matches", () => ({ createMatch: mocks.createMatch }));

import "./matches";

describe("match creation game modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: "player" });
    mocks.createMatch.mockResolvedValue({ ok: true, match: { id: "new-match" } });
  });

  async function create(body: unknown) {
    return mocks.post({
      request: new Request("http://localhost/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
  }

  const setup = {
    competitors: [{ playerIds: ["player"] }, { playerIds: ["opponent"] }],
    mapId: null,
  };

  it("defaults older clients to Sudden Death", async () => {
    const response = await create(setup);
    expect(response.status).toBe(201);
    expect(mocks.createMatch).toHaveBeenCalledWith("player", setup.competitors, null, [
      "Sudden Death",
    ]);
  });

  it("passes every enabled game mode to match creation", async () => {
    const gameModes = [
      "Lethal Spikes",
      "srennuRdeepS",
      "SuperSpeedRunners",
      "SpeedRapture",
      "Destructible Environment",
    ];
    const response = await create({ ...setup, gameModes });
    expect(response.status).toBe(201);
    expect(mocks.createMatch).toHaveBeenCalledWith("player", setup.competitors, null, gameModes);
  });

  it("rejects unknown and duplicate modes", async () => {
    const response = await create({ ...setup, gameModes: ["Sudden Death", "Unknown mode"] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Choose valid game modes." });
    const duplicateResponse = await create({
      ...setup,
      gameModes: ["Sudden Death", "Sudden Death"],
    });
    expect(duplicateResponse.status).toBe(400);
    expect(await duplicateResponse.json()).toEqual({ error: "Choose valid game modes." });
    expect(mocks.createMatch).not.toHaveBeenCalled();
  });
});
