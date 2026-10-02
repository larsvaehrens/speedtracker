import type { MatchView } from "#/domain/views";
import { PlayerIdentity } from "./PlayerIdentity";

function roundPoints(match: MatchView, playerId: string): number {
  return match.rounds
    .filter((round) => !round.undone)
    .flatMap((round) => round.attributions)
    .filter((attribution) => attribution.playerId === playerId)
    .reduce((total, attribution) => total + attribution.points, 0);
}

function pointLabel(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

export function MatchCompetitors({ match }: { match: MatchView }) {
  return (
    <span className="history-competitors">
      {match.competitors.map((competitor) => (
        <span
          className={`history-competitor${competitor.id === match.winnerCompetitorId ? " is-winner" : ""}`}
          key={competitor.id}
        >
          <span className="history-player-names">
            {competitor.players.map((player) => (
              <PlayerIdentity key={player.id} player={player}>
                {player.screenName}
                <small className="round-point-line">
                  {pointLabel(roundPoints(match, player.id))}
                </small>
              </PlayerIdentity>
            ))}
          </span>
          <strong>{competitor.score}</strong>
        </span>
      ))}
    </span>
  );
}
