import type { MatchView } from "#/domain/views";
import { formatDuration } from "#/lib/time";
import { PlayerIdentity } from "./PlayerIdentity";
import { MapThumbnail } from "./MapThumbnail";

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
                <div className="history-map">
                  {match.map && <MapThumbnail imagePath={match.map.imagePath} />}
                  <div>
                    <p className={`result-label ${won ? "result-win" : "result-loss"}`}>
                      {won ? "Match win" : "Match loss"}
                    </p>
                    <h2>{match.map?.name ?? "Map missing"}</h2>
                  </div>
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
                      {competitor.players.map((player) => (
                        <PlayerIdentity key={player.id} player={player}>
                          {player.screenName}
                          <small className="round-credit-line">
                            {personalPoints(match, player.id)} round credits
                          </small>
                        </PlayerIdentity>
                      ))}
                    </span>
                    <strong>{competitor.score}</strong>
                  </div>
                ))}
              </div>
              <div className="history-rounds-container">
                <details className="history-rounds">
                  <summary>
                    Round breakdown · {match.rounds.filter((round) => !round.undone).length} credited
                  </summary>
                  <ol className="round-list">
                    {match.rounds.map((round) => {
                      const winner = match.competitors.find(
                        ({ id }) => id === round.winnerCompetitorId,
                      );
                      return (
                        <li className={round.undone ? "round-undone" : ""} key={round.id}>
                          <span className="round-number">R{round.sequence}</span>
                          <span className="history-round-players">
                            {winner?.players.map((player) => (
                              <PlayerIdentity key={player.id} player={player}>
                                {player.screenName}
                                {` +${round.attributions.find(({ playerId }) => playerId === player.id)?.points ?? 0}`}
                              </PlayerIdentity>
                            ))}
                            <span>won</span>
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
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
