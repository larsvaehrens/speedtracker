import type { CompetitorView, RoundView } from "#/domain/views";
import { formatDuration } from "#/lib/time";
import { PlayerIdentity } from "./PlayerIdentity";

type RoundTimelineProps = {
  rounds: RoundView[];
  competitors: CompetitorView[];
  startedAt: string;
  endLabel: string;
};

function formatElapsedTime(scoredAt: string, startedAt: string): string {
  return formatDuration((Date.parse(scoredAt) - Date.parse(startedAt)) / 1000);
}

export function RoundTimeline({ rounds, competitors, startedAt, endLabel }: RoundTimelineProps) {
  return (
    <>
      <div className="round-timeline-endpoints">
        <span>0:00 · Match start</span>
        <span>{endLabel} · Match end</span>
      </div>
      <div className="round-timeline-scroll">
        <ol className="round-timeline">
          {rounds.map((round) => {
            const winner = competitors.find(({ id }) => id === round.winnerCompetitorId);
            return (
              <li
                className={`round-timeline-event${round.undone ? " round-undone" : ""}`}
                key={round.id}
              >
                <time className="round-timeline-time" dateTime={round.scoredAt}>
                  {formatElapsedTime(round.scoredAt, startedAt)}
                </time>
                <span aria-hidden="true" className="round-timeline-track">
                  <span className="round-timeline-marker" />
                </span>
                <span className="history-round-players">
                  {winner?.players.map((player) => (
                    <PlayerIdentity key={player.id} player={player}>
                      {player.screenName}
                      {` +${round.attributions.find(({ playerId }) => playerId === player.id)?.points ?? 0}`}
                    </PlayerIdentity>
                  ))}
                </span>
                {round.undone && <span className="muted">Undone</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
