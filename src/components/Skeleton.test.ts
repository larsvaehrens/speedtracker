import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AppSkeleton } from "./AppSkeleton";
import { Skeleton } from "./Skeleton";
import { StatisticsSkeleton } from "./StatisticsSkeleton";
import { StatisticsView } from "./StatisticsView";
import { SpeedTrackerApp } from "./SpeedTrackerApp";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("#/server/auth-client", () => ({ authClient: { useSession } }));

describe("loading skeletons", () => {
  beforeEach(() => {
    useSession.mockReset();
  });

  it("renders decorative, size-reserving placeholders without interactive controls", () => {
    const markup = renderToStaticMarkup(
      createElement(Skeleton, { width: 80, height: 50, className: "skeleton-map" }),
    );
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('class="skeleton skeleton-map"');
    expect(markup).toContain("width:80px;height:50px");
    expect(markup).not.toContain("tabindex");
  });

  it("preserves the app shell, five navigation slots, and default setup layout", () => {
    const markup = renderToStaticMarkup(
      createElement(AppSkeleton, { label: "Loading your matches" }),
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Loading your matches"');
    expect(markup).toContain('class="app-header"');
    expect(markup.match(/class="nav-tab skeleton-nav-tab"/g)).toHaveLength(5);
    expect(markup.match(/class="competitor-setup"/g)).toHaveLength(2);
    expect(markup).toContain('class="app-footer"');
    expect(markup).toContain('href="https://github.com/larsvaehrens/speedtracker"');
    expect(markup).not.toContain("<button");
  });

  it("matches the five overview cards, four panels, and five streak slots in statistics", () => {
    const markup = renderToStaticMarkup(createElement(StatisticsSkeleton, { hasMatches: true }));
    expect(markup).toContain('aria-label="Loading statistics"');
    expect(markup.match(/<article class="stat-card/g)).toHaveLength(5);
    expect(markup.match(/class="panel stats-panel/g)).toHaveLength(4);
    expect(markup).toContain("Total time played");
    expect(markup).toContain("Flawless wins");
    expect(markup).toContain("Shutout losses");
    expect(markup).toContain('class="match-filters panel"');
    expect(markup.match(/class="skeleton-filter-control"/g)).toHaveLength(5);
    expect(markup).toContain("Against opponents");
    expect(markup).toContain("With teammates");
    expect(markup).toContain("Longest playing streak");
    expect(markup.indexOf("<h2>Streaks</h2>")).toBeLessThan(markup.indexOf("<h2>By map</h2>"));
    expect(markup).not.toContain("<button");
  });

  it("reserves the empty statistics layout instead of displaying oversized result panels", () => {
    const markup = renderToStaticMarkup(createElement(StatisticsSkeleton, { hasMatches: false }));
    expect(markup).toContain('class="empty-state panel skeleton-empty"');
    expect(markup).not.toContain('class="stats-grid"');
    expect(markup.match(/<article class="stat-card/g)).toHaveLength(5);
  });

  it("uses the statistics skeleton while the request is loading", () => {
    const markup = renderToStaticMarkup(
      createElement(StatisticsView, { playerNames: {}, hasMatches: true }),
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('class="stats-overview"');
    expect(markup).toContain('class="stats-grid"');
  });

  it("uses the shell skeleton while the session is pending", () => {
    useSession.mockReturnValue({ data: null, isPending: true });
    const markup = renderToStaticMarkup(createElement(SpeedTrackerApp));
    expect(markup).toContain('aria-label="Loading SpeedTracker"');
    expect(markup).not.toContain("Could not load SpeedTracker");
  });

  it("does not flash an error before the initial bootstrap request starts", () => {
    useSession.mockReturnValue({ data: { user: { id: "player" } }, isPending: false });
    const markup = renderToStaticMarkup(createElement(SpeedTrackerApp));
    expect(markup).toContain('aria-label="Loading your matches"');
    expect(markup).not.toContain("Could not load SpeedTracker");
  });

  it("keeps the sign-in view when the session finishes without a user", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    const markup = renderToStaticMarkup(createElement(SpeedTrackerApp));
    expect(markup).toContain('class="auth-shell"');
    expect(markup).not.toContain('role="status"');
  });

  it("identifies the followed player and keeps Back available while statistics load", () => {
    const markup = renderToStaticMarkup(
      createElement(StatisticsView, {
        playerNames: {},
        hasMatches: true,
        player: { id: "friend", screenName: "Friend", avatar: "/friend.png" },
        onBack: () => {},
      }),
    );
    expect(markup).toContain("Friend&#x27;s statistics");
    expect(markup).toContain('src="/friend.png"');
    expect(markup).toContain("Back to players");
    expect(markup).toContain('aria-busy="true"');
  });
});
