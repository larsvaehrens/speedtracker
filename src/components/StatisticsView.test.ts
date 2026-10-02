import { calculateStatistics } from "#/domain/statistics";
import type { CompletedMatch } from "#/domain/types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatisticsContent } from "./StatisticsView";

describe("monthly trends across statistics views", () => {
  it("shows all seven requested trends alongside unchanged all-time values", () => {
    const matches: CompletedMatch[] = [
      { completedAt: "2026-09-01T12:00:00Z", won: true, seconds: 90, points: 3 },
      { completedAt: "2026-08-01T12:00:00Z", won: false, seconds: 30, points: 1 },
      { completedAt: "2026-08-02T12:00:00Z", won: true, seconds: 30, points: 1 },
    ].map(({ completedAt, won, seconds, points }) => ({
      id: completedAt,
      revision: 1,
      status: "completed",
      mapId: "map",
      startedAt: new Date(Date.parse(completedAt) - seconds * 1000).toISOString(),
      completedAt,
      winnerCompetitorId: won ? "own" : "opposition",
      gameModes: ["Sudden Death"],
      competitors: [
        { id: "own", playerIds: ["player", "teammate"] },
        { id: "opposition", playerIds: ["opponent"] },
      ],
      rounds: [
        {
          id: completedAt,
          submissionId: completedAt,
          sequence: 1,
          scoredAt: completedAt,
          winnerCompetitorId: "own",
          survivingPlayerIds: ["player"],
          attributions: [{ playerId: "player", points }],
          undone: false,
        },
      ],
    }));
    const stats = calculateStatistics(
      "player",
      matches,
      [{ id: "map", name: "Casino", imagePath: "/ressources/maps/12_Casino.png", order: 12 }],
      { timeZone: "UTC", now: new Date("2026-09-15T12:00:00Z") },
    );
    const markup = renderToStaticMarkup(
      createElement(StatisticsContent, {
        stats,
        names: { teammate: "Teammate", opponent: "Opponent" },
        avatars: { teammate: "/teammate.png", opponent: "/opponent.png" },
      }),
    );

    expect(markup.match(/class="stat-trend stat-trend-/g)).toHaveLength(7);
    expect(markup.match(/67%/g)).toHaveLength(4);
    expect(markup.match(/<span>\+100%<\/span>/g)).toHaveLength(4);
    expect(markup.match(/<span>\+50%<\/span>/g)).toHaveLength(2);
    expect(markup).toContain("<span>-50%</span>");
    expect(markup).not.toContain("This month:");
    expect(markup).not.toContain("monthly-comparison-note");
    expect(markup).toContain('src="/teammate.png"');
    expect(markup).toContain('src="/opponent.png"');
    expect(markup).toContain('src="/ressources/maps/12_Casino.png"');
    expect(markup).toContain("Total time");
    expect(markup).toContain("2.5 minutes");
    expect(markup).toContain("Avg match");
    expect(markup).toContain("0:50");
    expect(markup).toContain("Shortest");
    expect(markup).toContain("0:30");
    expect(markup).toContain("Longest");
    expect(markup).toContain("1:30");
    expect(markup).toContain("Flawless wins");
    expect(markup).toContain("Won without conceding a credit");
    expect(markup).toContain("Shutout losses");
    expect(markup).toContain("Lost without scoring a credit");
    expect(markup.indexOf("<h2>Streaks</h2>")).toBeLessThan(markup.indexOf("<h2>By map</h2>"));
    expect(markup.indexOf('class="stats-side-panels"')).toBeLessThan(
      markup.indexOf("<h2>Against opponents</h2>"),
    );
    const withoutPriorMatches = calculateStatistics(
      "player",
      [matches[0]],
      [{ id: "map", name: "Casino", imagePath: "/ressources/maps/12_Casion.png", order: 12 }],
      { timeZone: "UTC", now: new Date("2026-09-15T12:00:00Z") },
    );
    const withoutIndicators = renderToStaticMarkup(
      createElement(StatisticsContent, { stats: withoutPriorMatches, names: {}, avatars: {} }),
    );
    expect(withoutIndicators).not.toContain('class="stat-trend');
    expect(withoutIndicators).not.toContain("No prior-period");
    expect(withoutIndicators).not.toContain("New activity");

    const followedMarkup = renderToStaticMarkup(
      createElement(StatisticsContent, {
        stats,
        names: { teammate: "Teammate", opponent: "Opponent" },
        avatars: {},
        player: { id: "player", screenName: "Followed", avatar: "/followed.png" },
        onBack: () => {},
      }),
    );
    expect(followedMarkup).toContain("Followed&#x27;s statistics");
    expect(followedMarkup).toContain("Points credited to this player");
    expect(followedMarkup).toContain("Followed&#x27;s points");
    expect(followedMarkup).not.toContain("Your points");
    expect(followedMarkup).toContain("Back to players");
  });
});
