import { describe, expect, it } from "vite-plus/test";
import { internalAuthEmail, validateUsername } from "./identity";

describe("login usernames", () => {
  it("accepts supported username characters and lengths", () => {
    expect(validateUsername("speed_runner7")).toBe(true);
    expect(validateUsername("a".repeat(24))).toBe(true);
  });

  it("rejects invalid lengths and characters", () => {
    expect(validateUsername("ab")).toBe(false);
    expect(validateUsername("this-name")).toBe(false);
    expect(validateUsername("a".repeat(25))).toBe(false);
  });

  it("creates only a non-routable internal Better Auth identifier", () => {
    expect(internalAuthEmail("SpeedRunner")).toBe("speedrunner@accounts.speedtracker.invalid");
    expect(() => internalAuthEmail("not valid")).toThrow();
  });
});
