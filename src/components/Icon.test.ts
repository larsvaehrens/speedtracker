import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryView } from "./HistoryView";
import { Icon } from "./Icon";
import { MapPicker } from "./MapPicker";
import { AppFooter } from "./AppFooter";

describe("interface icons", () => {
  it.each(["chevron-down", "close", "arrow-left", "clock", "status-dot", "github"] as const)(
    "renders %s as a decorative, non-focusable SVG",
    (name) => {
      const markup = renderToStaticMarkup(createElement(Icon, { name }));
      expect(markup).toContain("<svg");
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('focusable="false"');
      expect(markup).toContain('viewBox="0 0 24 24"');
      expect(markup).toMatch(/<(path|circle) /);
    },
  );

  it("supports explicit dimensions and layout classes", () => {
    const markup = renderToStaticMarkup(
      createElement(Icon, { name: "clock", size: 32, className: "empty-icon" }),
    );
    expect(markup).toContain('class="icon empty-icon"');
    expect(markup).toContain('height="32"');
    expect(markup).toContain('width="32"');
  });

  it("preserves the map selector close button's accessible label", () => {
    const markup = renderToStaticMarkup(
      createElement(MapPicker, {
        maps: [],
        selectedMapId: null,
        open: false,
        onSelect: () => {},
        onClose: () => {},
      }),
    );
    expect(markup).toMatch(/aria-label="Close map selector"[^>]*><svg/);
    expect(markup).not.toContain("×");
  });

  it("uses a clock icon for empty history without changing its message", () => {
    const markup = renderToStaticMarkup(
      createElement(HistoryView, { matches: [], viewerId: "me", onOpen: () => {} }),
    );
    expect(markup).toContain('class="icon empty-icon"');
    expect(markup).toContain("No completed matches yet");
    expect(markup).not.toContain("◷");
  });

  it("links the footer to the repository with a GitHub icon", () => {
    const markup = renderToStaticMarkup(createElement(AppFooter));
    expect(markup).toContain('href="https://github.com/larsvaehrens/speedtracker"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain("GitHub");
    expect(markup).toContain('<svg aria-hidden="true"');
    expect(markup).toContain('fill="currentColor" stroke="none"');
  });
});
