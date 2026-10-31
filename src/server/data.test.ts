import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { all, bind, prepare } = vi.hoisted(() => {
  const all = vi.fn();
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind }));
  return { all, bind, prepare };
});

vi.mock("cloudflare:workers", () => ({ env: { DB: { prepare } } }));

import { getCompletedMatchPlayers, getRecommendedFriends } from "./data";

describe("recommended friends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps friends-of-friends rows with mutual counts, excluding self and existing friends in SQL", async () => {
    all.mockResolvedValue({
      results: [{ id: "rec", username: "rec", screen_name: "Rec", avatar: null, mutual_count: 3 }],
    });
    expect(await getRecommendedFriends("viewer", 5)).toEqual([
      { id: "rec", username: "rec", screenName: "Rec", avatar: null, mutualCount: 3 },
    ]);
    expect(bind).toHaveBeenCalledWith("viewer", "viewer", "viewer", 5);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("NOT EXISTS"));
  });
});

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
