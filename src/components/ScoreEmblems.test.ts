import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ScoreEmblems } from "./ScoreEmblems";

describe("scoring button emblems", () => {
  it.each([0, 1, 2, 3])("shows the next point for a single point at score %i", (score) => {
    const markup = renderToStaticMarkup(createElement(ScoreEmblems, { score, points: 1 }));

    expect(markup.match(/<img /g)).toHaveLength(1);
    expect(markup).toContain(`src="/resources/emblems/emblem-${score + 1}.png"`);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('alt=""');
  });

  it.each([
    { score: 0, emblems: [1, 2] },
    { score: 1, emblems: [2, 3] },
    { score: 2, emblems: [3, 4] },
    { score: 3, emblems: [4, 5] },
  ])("shows $emblems for a double win at score $score", ({ score, emblems }) => {
    const markup = renderToStaticMarkup(createElement(ScoreEmblems, { score, points: 2 }));
    const sources = [...markup.matchAll(/<img [^>]*src="([^"]+)"/g)].map((match) => match[1]);

    expect(sources).toEqual(emblems.map((emblem) => `/resources/emblems/emblem-${emblem}.png`));
  });
});
