import { describe, expect, it } from "vite-plus/test";
import { canEditMatch, canViewMatch } from "./permissions";

describe("match permissions", () => {
  it("allows the creator to view and edit", () => {
    expect(canViewMatch("creator", false, "creator")).toBe(true);
    expect(canEditMatch("creator", "creator")).toBe(true);
  });

  it("allows another participant to view but not edit", () => {
    expect(canViewMatch("creator", true, "participant")).toBe(true);
    expect(canEditMatch("creator", "participant")).toBe(false);
  });

  it("does not grant unrelated users access", () => {
    expect(canViewMatch("creator", false, "unrelated")).toBe(false);
    expect(canEditMatch("creator", "unrelated")).toBe(false);
  });
});
