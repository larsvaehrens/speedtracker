import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_MATCH_FILTERS } from "#/domain/match-filters";
import { MatchFilters } from "./MatchFilters";

describe("match filter controls", () => {
  it("groups calendar presets and bounded date inputs in a date-range modal", () => {
    const markup = renderToStaticMarkup(
      createElement(MatchFilters, {
        value: {
          ...EMPTY_MATCH_FILTERS,
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          mapIds: ["map"],
          teammateIds: [],
          opponentIds: [],
        },
        maps: [{ id: "map", label: "Casino", imagePath: "/map.png" }],
        teammates: [{ id: "ally", label: "Ally", avatar: "/ally.png" }],
        opponents: [{ id: "opponent", label: "Opponent", avatar: null }],
        onChange: vi.fn(),
        onReset: vi.fn(),
        isActive: true,
      }),
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("Jan 1, 2026 – Jan 31, 2026");
    expect(markup).toContain('class="modal date-range-modal"');
    expect(markup).not.toContain('class="modal date-range-modal" open');
    expect(markup).toContain('aria-labelledby="date-range-title"');
    expect(markup).toContain('aria-label="Date range preset"');
    expect(markup).toContain(">This week</option>");
    expect(markup).toContain(">Last week</option>");
    expect(markup).toContain(">This month</option>");
    expect(markup).toContain(">Last month</option>");
    expect(markup).toContain(">This quarter</option>");
    expect(markup).toContain(">Last quarter</option>");
    expect(markup).toContain(">This year</option>");
    expect(markup).toContain(">Last year</option>");
    expect(markup).toContain('aria-label="Start date"');
    expect(markup).toContain('max="2026-01-31"');
    expect(markup).toContain('aria-label="End date"');
    expect(markup).toContain('min="2026-01-01"');
    expect(markup).toContain("Maps");
    expect(markup.indexOf('class="date-range-trigger"')).toBeLessThan(
      markup.indexOf("<summary><span>Maps</span>"),
    );
    expect(markup).toContain("Teammates");
    expect(markup).toContain("Opponents");
    expect(markup).toContain("Casino");
    expect(markup).toContain("Ally");
    expect(markup).toContain("Opponent");
    expect(markup).toContain("Clear filters");
    expect(markup).toContain("Clear dates");
    expect(markup).toContain("Apply date range");
  });

  it("omits the clear action when no filters are selected", () => {
    const markup = renderToStaticMarkup(
      createElement(MatchFilters, {
        value: EMPTY_MATCH_FILTERS,
        maps: [],
        teammates: [],
        opponents: [],
        onChange: vi.fn(),
        onReset: vi.fn(),
        isActive: false,
      }),
    );
    expect(markup).toContain("No maps available");
    expect(markup).toContain("No teammates available");
    expect(markup).toContain("No opponents available");
    expect(markup).not.toContain("Clear filters");
  });
});
