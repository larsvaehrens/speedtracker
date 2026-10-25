import { describe, expect, it } from "vite-plus/test";
import { arrangementKey, validateSetup } from "./setup";

const arrangements = [
  [1, 1],
  [1, 1, 1],
  [1, 1, 1, 1],
  [2, 2],
  [1, 2],
  [1, 1, 2],
];

describe("supported competitor arrangements", () => {
  it.each(arrangements)("accepts arrangement %j", (...sizes) => {
    let playerNumber = 0;
    const competitors = sizes.map((size) => ({
      playerIds: Array.from({ length: size }, () => `player-${playerNumber++}`),
    }));
    const eligible = new Set(competitors.flatMap(({ playerIds }) => playerIds));

    expect(validateSetup(competitors, "player-0", eligible)).toBeNull();
    expect(arrangementKey(competitors)).toBe([...sizes].sort().join("-"));
  });
});

describe("setup validation", () => {
  it("rejects duplicate players across competitors", () => {
    expect(
      validateSetup(
        [{ playerIds: ["creator"] }, { playerIds: ["creator"] }],
        "creator",
        new Set(["creator"]),
      ),
    ).toBe("duplicate-player");
  });

  it("requires the creator and only available players", () => {
    expect(
      validateSetup(
        [{ playerIds: ["friend-a"] }, { playerIds: ["friend-b"] }],
        "creator",
        new Set(["friend-a", "friend-b"]),
      ),
    ).toBe("missing-creator");

    expect(
      validateSetup(
        [{ playerIds: ["creator"] }, { playerIds: ["stranger"] }],
        "creator",
        new Set(["creator"]),
      ),
    ).toBe("unavailable-player");
  });

  it("rejects unsupported team sizes and arrangements", () => {
    expect(validateSetup([{ playerIds: ["a", "b", "c"] }], "a", new Set(["a", "b", "c"]))).toBe(
      "invalid-team-size",
    );

    expect(
      validateSetup(
        [
          { playerIds: ["a"] },
          { playerIds: ["b"] },
          { playerIds: ["c"] },
          { playerIds: ["d", "e"] },
        ],
        "a",
        new Set(["a", "b", "c", "d", "e"]),
      ),
    ).toBe("too-many-players");
  });
});
