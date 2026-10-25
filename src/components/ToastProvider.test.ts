import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ToastProvider, useToast } from "./ToastProvider";

function Consumer() {
  useToast();
  return createElement("main", null, "Page content");
}

describe("toast provider", () => {
  it("renders page content with a separate notification viewport and no initial notices", () => {
    const markup = renderToStaticMarkup(
      createElement(ToastProvider, { children: createElement(Consumer) }),
    );
    expect(markup).toContain("<main>Page content</main>");
    expect(markup).toContain('aria-label="Notifications"');
    expect(markup).toContain('class="toast-viewport"');
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain('role="alert"');
  });

  it("fails clearly if a notification consumer is not wired to the provider", () => {
    expect(() => renderToStaticMarkup(createElement(Consumer))).toThrow(
      "useToast must be used within ToastProvider.",
    );
  });

  it("keeps toast layout independent of the skeleton's fixed height", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.toast-viewport\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.toast\s*\{[^}]*display:\s*flex/);
    expect(css).not.toMatch(/\.skeleton\s*,\s*\.toast\s*\{[^}]*height:\s*1em/);
  });
});
