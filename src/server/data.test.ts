import { beforeEach, describe, expect, it, vi } from "vitest";

const { all, bind, prepare } = vi.hoisted(() => {
  const all = vi.fn();
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind }));
  return { all, bind, prepare };
});

vi.mock("cloudflare:workers", () => ({ env: { DB: { prepare } } }));

import { getCompletedMatchPlayers } from "./data";

describe("statistics participant profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns names and avatars for completed-match participants, including unfollowed players", async () => {
    all.mockResolvedValue({
      results: [
        { id: "opponent", screen_name: "Opponent", avatar: "/opponent.png" },
        { id: "teammate", screen_name: "Teammate", avatar: null },
      ],
    });
    expect(await getCompletedMatchPlayers("viewer")).toEqual({
      opponent: { screenName: "Opponent", avatar: "/opponent.png" },
      teammate: { screenName: "Teammate", avatar: null },
    });
    expect(bind).toHaveBeenCalledWith("viewer");
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("participant.image AS avatar"));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("viewer.player_id = ?"));
  });

  it("returns an empty profile map when there are no completed matches", async () => {
    all.mockResolvedValue({ results: [] });
    expect(await getCompletedMatchPlayers("viewer")).toEqual({});
  });
});
