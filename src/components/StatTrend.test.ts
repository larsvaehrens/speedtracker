import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { StatTrend, WinRateTrend } from "./StatTrend";

describe("monthly trend indicators", () => {
  it("shows a compact percentage-change arrow with sample sizes in its tooltip", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, {
        current: 0.75,
        previous: 0.5,
        unit: "rate",
        currentSamples: 4,
        previousSamples: 2,
      }),
    );
    expect(markup).toContain("+50%");
    expect(markup).not.toContain("stat-trend-value");
    expect(markup).toContain("4 matches this month; 2 in the previous period");
    expect(markup).toContain("stat-trend-up");
    expect(markup).toContain("<svg");
  });

  it("shows decreases in activity relative to the previous period", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, { current: 3, previous: 4, unit: "count" }),
    );
    expect(markup).toContain("-25%");
    expect(markup).toContain("stat-trend-down");
    expect(markup).toContain("trend-icon-down");
  });

  it("labels a selected date range and its preceding equal-length comparison", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, {
        current: 5,
        previous: 4,
        unit: "count",
        currentPeriodLabel: "Mar 15, 2026",
        comparisonLabel: "Mar 14, 2026",
      }),
    );
    expect(markup).toContain("vs Mar 14, 2026");
    expect(markup).toContain("(Mar 15, 2026)");
  });

  it("formats play time while calculating its change from seconds", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, { current: 5400, previous: 3600, unit: "duration" }),
    );
    expect(markup).toContain("1.5 hours vs 1 hour");
    expect(markup).toContain("+50%");
  });

  it("hides an undefined percentage increase from zero", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, { current: 3, previous: 0, unit: "count" }),
    );
    expect(markup).toBe("");
  });

  it.each([0, 4])("hides unchanged activity at %i", (value) => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, { current: value, previous: value, unit: "count" }),
    );
    expect(markup).toBe("");
  });

  it("shows a complete decline to zero as a 100% decrease", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, { current: 0, previous: 4, unit: "count" }),
    );
    expect(markup).toContain("-100%");
  });

  it("does not compare a sampled win rate with an absent baseline", () => {
    const markup = renderToStaticMarkup(
      createElement(WinRateTrend, {
        current: { winRate: 1, matches: 1 },
        previous: undefined,
      }),
    );
    expect(markup).toBe("");
  });

  it("marks a missing current period without implying a win-rate decline", () => {
    const markup = renderToStaticMarkup(
      createElement(WinRateTrend, {
        current: undefined,
        previous: { winRate: 1, matches: 1 },
      }),
    );
    expect(markup).toBe("");
  });

  it("can compare a legitimate 0% win rate with a sampled prior period", () => {
    const markup = renderToStaticMarkup(
      createElement(WinRateTrend, {
        current: { winRate: 0, matches: 2 },
        previous: { winRate: 0.5, matches: 2 },
      }),
    );
    expect(markup).toContain("-100%");
  });

  it("does not label a small measurable change as unchanged", () => {
    const markup = renderToStaticMarkup(
      createElement(StatTrend, { current: 0.5001, previous: 0.5, unit: "rate" }),
    );
    expect(markup).toContain("&lt;0.1%");
    expect(markup).toContain("stat-trend-up");
    expect(markup).not.toContain("No change");
  });

  it("hides rates with a zero baseline even when that period had matches", () => {
    const markup = renderToStaticMarkup(
      createElement(WinRateTrend, {
        current: { winRate: 1, matches: 2 },
        previous: { winRate: 0, matches: 2 },
      }),
    );
    expect(markup).toBe("");
  });
});
