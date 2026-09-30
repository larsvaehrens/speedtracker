import { describe, expect, it } from "vitest";
import { formatDuration, formatPlayedTime } from "./time";

describe("total played time", () => {
  it.each([
    [0, "0 minutes"],
    [30, "< 1 minute"],
    [59, "< 1 minute"],
    [60, "1 minute"],
    [90, "1.5 minutes"],
    [3599, "59.9 minutes"],
    [3600, "1 hour"],
    [5400, "1.5 hours"],
    [86399, "23.9 hours"],
    [86400, "1 day"],
    [129600, "1.5 days"],
    [172800, "2 days"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatPlayedTime(seconds)).toBe(expected);
  });
});

describe("match duration", () => {
  it("preserves minute-and-second formatting", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3600)).toBe("60:00");
  });
});
