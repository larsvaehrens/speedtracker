import { useEffect, useState } from "react";
import type { PlayerStatistics } from "#/domain/statistics";
import { apiRequest, apiMessage } from "#/lib/api";
import { formatPlayedTime } from "#/lib/time";
import { PlayerAvatar } from "./PlayerAvatar";
import { MapThumbnail } from "./MapThumbnail";

type StatisticsViewProps = {
  playerNames: Record<string, string>;
};

type StatisticsResponse = {
  statistics: PlayerStatistics;
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
};

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function displayName(names: Record<string, string>, id: string): string {
  return names[id] ?? "Player";
}

export function StatisticsView({ playerNames }: StatisticsViewProps) {
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [names, setNames] = useState(playerNames);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    apiRequest<StatisticsResponse>(`/api/statistics?timeZone=${encodeURIComponent(timeZone)}`)
      .then((result) => {
        if (cancelled) return;
        setStats(result.statistics);
        setNames(result.playerNames);
        setAvatars(result.playerAvatars);
        setError("");
      })
      .catch((loadError) => {
        if (!cancelled) setError(apiMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="page-section muted">Loading statistics…</p>;
  if (error) {
    return (
      <section className="page-section">
        <p className="eyebrow">Completed Matches only</p>
        <h1>Statistics</h1>
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (!stats) return null;

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Completed Matches only</p>
          <h1>Statistics</h1>
          <p className="muted">
            Match results and individual Round credits are counted separately.
          </p>
        </div>
      </div>

      <div className="stats-overview">
        <article className="stat-card stat-featured">
          <span className="muted">Match win rate</span>
          <strong>{percent(stats.matchWinRate)}</strong>
          <span>
            {stats.matchWins} wins · {stats.matchesPlayed} played
          </span>
        </article>
        <article className="stat-card">
          <span className="muted">Individual Round credits</span>
          <strong>{stats.roundCredits}</strong>
          <span>Points credited to you</span>
        </article>
        <article className="stat-card">
          <span className="muted">Current streak</span>
          <strong>
            {stats.currentStreak.length === 0
              ? "—"
              : `${stats.currentStreak.length} ${stats.currentStreak.kind === "win" ? "wins" : "losses"}`}
          </strong>
          <span>
            Longest: {stats.longestWinStreak.length} wins · {stats.longestLossStreak.length} losses
          </span>
        </article>
        <article className="stat-card">
          <span className="muted">Total time played</span>
          <strong>{formatPlayedTime(stats.totalPlayedSeconds)}</strong>
          <span style={{ visibility: "hidden" }}>Time in completed Matches</span>
        </article>
      </div>

      {stats.matchesPlayed === 0 ? (
        <div className="empty-state panel">
          <h2>Statistics will appear after your first Match</h2>
          <p className="muted">
            Abandoned Matches and individual Rounds do not count as completed Matches.
          </p>
        </div>
      ) : (
        <div className="stats-grid">
          <section className="panel stats-panel">
            <div className="panel-heading">
              <div>
                <h2>By map</h2>
                <p className="muted">Ranked by win rate · sample size shown</p>
              </div>
            </div>
            {stats.maps.length === 0 ? (
              <p className="empty-inline">No map results yet.</p>
            ) : (
              <div className="stat-list">
                {stats.maps.map((map) => (
                  <div className="stat-row" key={map.mapId}>
                    <span className="stat-map">
                      <MapThumbnail imagePath={map.imagePath} />
                      <span className="stat-row-title">
                        <strong>{map.name}</strong>
                        <small>
                          {map.wins} wins · {map.matches} played
                        </small>
                      </span>
                    </span>
                    <strong>{percent(map.winRate)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel stats-panel">
            <div className="panel-heading">
              <div>
                <h2>Against opponents</h2>
                <p className="muted">Teammates are excluded</p>
              </div>
            </div>
            {stats.opponents.length === 0 ? (
              <p className="empty-inline">No opponent results yet.</p>
            ) : (
              <div className="stat-list">
                {stats.opponents.map((opponent) => (
                  <div className="stat-row" key={opponent.playerId}>
                    <span className="stat-player">
                      <PlayerAvatar avatar={avatars[opponent.playerId] ?? null} />
                      <span className="stat-row-title">
                        <strong>{displayName(names, opponent.playerId)}</strong>
                        <small>
                          {opponent.wins} wins · {opponent.losses} losses · {opponent.matches}{" "}
                          played
                        </small>
                      </span>
                    </span>
                    <strong>{percent(opponent.winRate)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel stats-panel">
            <div className="panel-heading">
              <div>
                <h2>With teammates</h2>
                <p className="muted">Match results and individual points credited to each Player</p>
              </div>
            </div>
            {stats.partnerships.length === 0 ? (
              <p className="empty-inline">
                Two-player team Matches will create partnership statistics.
              </p>
            ) : (
              <div className="stat-list">
                {stats.partnerships.map((pair) => (
                  <div className="partnership-row" key={pair.teammateId}>
                    <div className="stat-row">
                      <span className="stat-player">
                        <PlayerAvatar avatar={avatars[pair.teammateId] ?? null} />
                        <span className="stat-row-title">
                          <strong>{displayName(names, pair.teammateId)}</strong>
                          <small>
                            {pair.wins} team wins · {pair.matches} Matches
                          </small>
                        </span>
                      </span>
                      <strong>{percent(pair.winRate)}</strong>
                    </div>
                    <div className="contribution-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.round((pair.playerShare ?? 0) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="contribution-copy">
                      Your points: {pair.playerPoints} ({percent(pair.playerShare)}) ·{" "}
                      {displayName(names, pair.teammateId)}: {pair.teammatePoints} (
                      {percent(pair.teammateShare)})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel stats-panel streak-panel">
            <div className="panel-heading">
              <div>
                <h2>Streaks</h2>
                <p className="muted">Ordered by completion time, then Match ID</p>
                <p className="muted">Daily streaks use your local calendar days.</p>
              </div>
            </div>
            <div className="streak-grid">
              <div>
                <span className="muted">Current</span>
                <strong>
                  {stats.currentStreak.kind === "none"
                    ? "No streak"
                    : `${stats.currentStreak.length} ${stats.currentStreak.kind === "win" ? "wins" : "losses"}`}
                </strong>
              </div>
              <div>
                <span className="muted">Longest winning</span>
                <strong>{stats.longestWinStreak.length}</strong>
              </div>
              <div>
                <span className="muted">Longest losing</span>
                <strong>{stats.longestLossStreak.length}</strong>
              </div>
              <div>
                <span className="muted">Daily playing streak</span>
                <strong>
                  {stats.playingDayStreak.current}{" "}
                  {stats.playingDayStreak.current === 1 ? "day" : "days"}
                </strong>
              </div>
              <div>
                <span className="muted">Longest playing streak</span>
                <strong>
                  {stats.playingDayStreak.longest}{" "}
                  {stats.playingDayStreak.longest === 1 ? "day" : "days"}
                </strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
