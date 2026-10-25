import type { CompetitorView, RoundView } from "#/domain/views";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { RoundTimeline } from "./RoundTimeline";

const competitors: CompetitorView[] = [
  {
    id: "team-1",
    kind: "team",
    sortOrder: 0,
    playerIds: ["player-1", "player-2"],
    players: [
      { id: "player-1", username: "scorer", screenName: "Scorer", avatar: null },
      { id: "player-2", username: "no-score", screenName: "No score", avatar: null },
    ],
    score: 1,
  },
];

const rounds: RoundView[] = [
  {
    id: "round-1",
    submissionId: "submission-1",
    sequence: 1,
    scoredAt: "2026-10-25T12:01:00.000Z",
    winnerCompetitorId: "team-1",
    survivingPlayerIds: ["player-1"],
    attributions: [
      { playerId: "player-1", points: 1 },
      { playerId: "player-2", points: 0 },
    ],
    undone: false,
  },
];

describe("RoundTimeline", () => {
  it("shows only players who scored points in a round", () => {
    const markup = renderToStaticMarkup(
      createElement(RoundTimeline, {
        rounds,
        competitors,
        startedAt: "2026-10-25T12:00:00.000Z",
        endLabel: "3:00",
      }),
    );

    expect(markup).toContain("Scorer");
    expect(markup).toContain("+1");
    expect(markup).not.toContain("No score");
  });
});
