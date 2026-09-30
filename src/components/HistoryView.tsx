import type { MatchView } from "#/domain/views";
import { formatDuration } from "#/lib/time";

type HistoryViewProps = {
  matches: MatchView[];
  viewerId: string;
  onOpen: (match: MatchView) => void;
};

function personalPoints(match: MatchView, playerId: string): number {
  return match.rounds
    .filter((round) => !round.undone)
    .flatMap((round) => round.attributions)
    .filter((attribution) => attribution.playerId === playerId)
    .reduce((total, attribution) => total + attribution.points, 0);
}

export function HistoryView({ matches, viewerId, onOpen }: HistoryViewProps) {
  if (matches.length === 0) {
    return (
      <section className="page-section">
        <p className="eyebrow">Completed Matches</p>
        <h1>Match history</h1>
        <div className="empty-state panel">
          <span aria-hidden="true" className="empty-icon">
            ◷
          </span>
          <h2>No completed Matches yet</h2>
          <p className="muted">
            Completed Matches will show the map, final scores, duration, Match outcome, and every
            credited Round here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Completed Matches</p>
          <h1>Match history</h1>
          <p className="muted">{matches.length} recent completed Matches</p>
        </div>
      </div>
      <div className="history-list">
        {matches.map((match) => {
          const ownCompetitor = match.competitors.find(({ playerIds }) =>
            playerIds.includes(viewerId),
          );
          const won = ownCompetitor?.id === match.winnerCompetitorId;
          return (
            <article className="history-card panel" key={match.id}>
              <div className="history-top">
                <div>
                  <p className={`result-label ${won ? "result-win" : "result-loss"}`}>
                    {won ? "Match win" : "Match loss"}
                  </p>
                  <h2>{match.map?.name ?? "Map missing"}</h2>
                </div>
                <span className="duration-pill">{formatDuration(match.durationSeconds ?? 0)}</span>
              </div>
              <div className="history-competitors">
                {match.competitors.map((competitor) => (
                  <div
                    className={`history-competitor${competitor.id === match.winnerCompetitorId ? " is-winner" : ""}`}
                    key={competitor.id}
                  >
                    <span className="history-player-names">
                      {competitor.players.map(({ screenName }) => screenName).join(" + ")}
                    </span>
                    <strong>{competitor.score}</strong>
                    <span className="round-credit-line">
                      {competitor.players
                        .map(
                          (player) =>
                            `${player.screenName} ${personalPoints(match, player.id)} round credits`,
                        )
                        .join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
              <details className="history-rounds">
                <summary>
                  Round breakdown · {match.rounds.filter((round) => !round.undone).length} credited
                </summary>
                <ol className="round-list">
                  {match.rounds.map((round) => {
                    const winner = match.competitors.find(
                      ({ id }) => id === round.winnerCompetitorId,
                    );
                    const credits = round.attributions
                      .map((attribution) => {
                        const player = winner?.players.find(
                          ({ id }) => id === attribution.playerId,
                        );
                        return `${player?.screenName ?? "Player"} +${attribution.points}`;
                      })
                      .join(", ");
                    return (
                      <li className={round.undone ? "round-undone" : ""} key={round.id}>
                        <span className="round-number">R{round.sequence}</span>
                        <span>
                          {winner?.players.map(({ screenName }) => screenName).join(" + ")} won ·{" "}
                          {credits}
                        </span>
                        {round.undone && <span className="muted">Undone</span>}
                      </li>
                    );
                  })}
                </ol>
              </details>
              <button
                className="button button-quiet history-open"
                onClick={() => onOpen(match)}
                type="button"
              >
                View Match
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
