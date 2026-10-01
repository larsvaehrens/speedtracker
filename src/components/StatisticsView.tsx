import { useEffect, useState } from "react";
import type { PlayerStatistics } from "#/domain/statistics";
import type { StatisticsPlayer } from "#/domain/views";
import { apiRequest, apiMessage } from "#/lib/api";
import { formatDuration, formatPlayedTime } from "#/lib/time";
import { PlayerAvatar } from "./PlayerAvatar";
import { MapThumbnail } from "./MapThumbnail";
import { StatisticsHeading, StatisticsSkeleton } from "./StatisticsSkeleton";
import { StatTrend, WinRateTrend } from "./StatTrend";
import {
  EMPTY_MATCH_FILTERS,
  type MatchFilters as MatchFiltersValue,
} from "#/domain/match-filters";
import { MatchFilters } from "./MatchFilters";

type StatisticsViewProps = {
  playerNames: Record<string, string>;
  hasMatches: boolean;
  player?: StatisticsPlayer;
  onBack?: () => void;
};

type StatisticsResponse = {
  statistics: PlayerStatistics;
  playerNames: Record<string, string>;
  playerAvatars: Record<string, string | null>;
  player: StatisticsPlayer;
  filterOptions: {
    maps: { id: string; label: string; imagePath: string }[];
    teammates: { id: string; label: string; avatar: string | null }[];
    opponents: { id: string; label: string; avatar: string | null }[];
  };
};

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function displayName(names: Record<string, string>, id: string): string {
  return names[id] ?? "Player";
}

export function StatisticsView({ playerNames, hasMatches, player, onBack }: StatisticsViewProps) {
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [names, setNames] = useState(playerNames);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(player);
  const [filters, setFilters] = useState<MatchFiltersValue>(EMPTY_MATCH_FILTERS);
  const [filterOptions, setFilterOptions] = useState<StatisticsResponse["filterOptions"]>({
    maps: [],
    teammates: [],
    opponents: [],
  });
  const playerId = player?.id;
  useEffect(() => {
    let cancelled = false;
    setError("");
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parameters = new URLSearchParams({ timeZone });
    if (playerId) parameters.set("playerId", playerId);
    if (filters.startDate) parameters.set("startDate", filters.startDate);
    if (filters.endDate) parameters.set("endDate", filters.endDate);
    for (const id of filters.mapIds) parameters.append("mapId", id);
    for (const id of filters.teammateIds) parameters.append("teammateId", id);
    for (const id of filters.opponentIds) parameters.append("opponentId", id);
    for (const mode of filters.gameModes) parameters.append("gameMode", mode);
    apiRequest<StatisticsResponse>(`/api/statistics?${parameters}`)
      .then((result) => {
        if (cancelled) return;
        setStats(result.statistics);
        setNames(result.playerNames);
        setAvatars(result.playerAvatars);
        setFilterOptions(result.filterOptions);
        setSubject(result.player);
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
  }, [filters, playerId]);

  if (loading)
    return <StatisticsSkeleton hasMatches={hasMatches} player={player} onBack={onBack} />;
  if (error && !stats) {
    return (
      <section className="page-section">
        <StatisticsHeading player={player} onBack={onBack} />
        <p className="form-error" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (!stats) return null;

  return (
    <StatisticsContent
      stats={stats}
      names={names}
      avatars={avatars}
      player={player ? subject : undefined}
      onBack={onBack}
      filters={filters}
      onFiltersChange={setFilters}
      filterOptions={filterOptions}
      error={error}
    />
  );
}

export function StatisticsContent({
  stats,
  names,
  avatars,
  player,
  onBack,
  filters = EMPTY_MATCH_FILTERS,
  onFiltersChange,
  filterOptions = { maps: [], teammates: [], opponents: [] },
  error = "",
}: {
  stats: PlayerStatistics;
  names: Record<string, string>;
  avatars: Record<string, string | null>;
  player?: StatisticsPlayer;
  onBack?: () => void;
  filters?: MatchFiltersValue;
  onFiltersChange?: (filters: MatchFiltersValue) => void;
  filterOptions?: StatisticsResponse["filterOptions"];
  error?: string;
}) {
  const comparison = stats.monthlyComparison;
  const trendPeriod = {
    currentPeriodLabel: comparison.currentMonth,
    comparisonLabel: comparison.previousMonth,
  };
  const filtersActive = Boolean(
    filters.startDate ||
    filters.endDate ||
    filters.mapIds.length ||
    filters.teammateIds.length ||
    filters.opponentIds.length ||
    filters.gameModes.length,
  );

  return (
    <section className="page-section">
      <StatisticsHeading player={player} onBack={onBack} />

      <MatchFilters
        isActive={filtersActive}
        maps={filterOptions.maps}
        onChange={onFiltersChange ?? (() => {})}
        onReset={() => onFiltersChange?.(EMPTY_MATCH_FILTERS)}
        opponents={filterOptions.opponents}
        teammates={filterOptions.teammates}
        value={filters}
      />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}

      <div className="stats-overview">
        <article className="stat-card stat-featured">
          <span className="muted">Match win rate</span>
          <strong className="stat-value">
            {percent(stats.matchWinRate)}
            <StatTrend
              {...trendPeriod}
              current={comparison.current.matchWinRate}
              previous={comparison.previous.matchWinRate}
              unit="rate"
              label="win rate"
              currentSamples={comparison.current.matchesPlayed}
              previousSamples={comparison.previous.matchesPlayed}
            />
          </strong>
          <span>
            {stats.matchWins} wins · {stats.matchesPlayed} played{" "}
            <StatTrend
              {...trendPeriod}
              current={comparison.current.matchesPlayed}
              previous={comparison.previous.matchesPlayed}
              unit="count"
              label="matches"
            />
          </span>
        </article>
        <article className="stat-card">
          <span className="muted">Individual round credits</span>
          <strong className="stat-value">
            {stats.roundCredits}
            <StatTrend
              {...trendPeriod}
              current={comparison.current.roundCredits}
              previous={comparison.previous.roundCredits}
              unit="count"
            />
          </strong>
          <span>{player ? "Points credited to this player" : "Points credited to you"}</span>
        </article>
        <article className="stat-card stat-card-positive">
          <span className="muted">Flawless wins</span>
          <strong>{stats.flawlessWins}</strong>
          <span>Won without conceding a credit</span>
        </article>
        <article className="stat-card stat-card-negative">
          <span className="muted">Shutout losses</span>
          <strong>{stats.shutoutLosses}</strong>
          <span>Lost without scoring a credit</span>
        </article>
        <article className="stat-card">
          <span className="muted">Total time played</span>
          <strong className="stat-value">
            {formatPlayedTime(stats.totalPlayedSeconds)}
            <StatTrend
              {...trendPeriod}
              current={comparison.current.totalPlayedSeconds}
              previous={comparison.previous.totalPlayedSeconds}
              unit="duration"
            />
          </strong>
          <span style={{ visibility: "hidden" }}>Time in completed matches</span>
        </article>
      </div>

      {stats.matchesPlayed === 0 ? (
        <div className="empty-state panel">
          <h2>
            {filtersActive
              ? "No completed matches match these filters"
              : player
                ? "No completed matches yet"
                : "Statistics will appear after your first match"}
          </h2>
          <p className="muted">
            {filtersActive
              ? "Try adjusting or clearing your selected filters."
              : "Abandoned matches and individual rounds do not count as completed matches."}
          </p>
        </div>
      ) : (
        <>
          <section className="panel stats-panel streak-panel">
            <div className="panel-heading">
              <div>
                <h2>Streaks</h2>
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
          <div className="stats-grid">
            <section className="panel stats-panel">
              <div className="panel-heading">
                <div>
                  <h2>By map</h2>
                  <p className="muted">Ranked by win rate</p>
                </div>
              </div>
              {stats.maps.length === 0 ? (
                <p className="empty-inline">No map results yet.</p>
              ) : (
                <div className="stat-list">
                  {stats.maps.map((map) => (
                    <div className="map-stat-row" key={map.mapId}>
                      <MapThumbnail
                        className="map-thumbnail map-stat-thumbnail"
                        imagePath={map.imagePath}
                      />
                      <div className="map-stat-content">
                        <div className="map-stat-heading">
                          <span className="map-stat-title">
                            <strong>{map.name}</strong>
                            <small>
                              {map.wins} wins · {map.matches} played
                            </small>
                          </span>
                          <div className="stat-row-metric">
                            <strong>{percent(map.winRate)}</strong>
                            <WinRateTrend
                              {...trendPeriod}
                              current={comparison.current.maps.find(
                                ({ mapId }) => mapId === map.mapId,
                              )}
                              previous={comparison.previous.maps.find(
                                ({ mapId }) => mapId === map.mapId,
                              )}
                            />
                          </div>
                        </div>
                        <div className="map-time-metrics">
                          <span className="map-time-metric">
                            <span className="map-time-metric-label">Total time</span>
                            <strong>{formatPlayedTime(map.totalPlayedSeconds)}</strong>
                          </span>
                          <span className="map-time-metric">
                            <span className="map-time-metric-label">Avg match</span>
                            <strong>{formatDuration(map.averageMatchSeconds)}</strong>
                          </span>
                          <span className="map-time-metric">
                            <span className="map-time-metric-label">Shortest</span>
                            <strong>{formatDuration(map.shortestMatchSeconds)}</strong>
                          </span>
                          <span className="map-time-metric">
                            <span className="map-time-metric-label">Longest</span>
                            <strong>{formatDuration(map.longestMatchSeconds)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="stats-side-panels">
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
                        <div className="stat-row-metric">
                          <strong>{percent(opponent.winRate)}</strong>
                          <WinRateTrend
                            {...trendPeriod}
                            current={comparison.current.opponents.find(
                              ({ playerId }) => playerId === opponent.playerId,
                            )}
                            previous={comparison.previous.opponents.find(
                              ({ playerId }) => playerId === opponent.playerId,
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel stats-panel">
                <div className="panel-heading">
                  <div>
                    <h2>With teammates</h2>
                    <p className="muted">
                      Match results and individual points credited to each player
                    </p>
                  </div>
                </div>
                {stats.partnerships.length === 0 ? (
                  <p className="empty-inline">
                    Two-player team matches will create partnership statistics.
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
                                {pair.wins} team wins · {pair.matches} matches
                              </small>
                            </span>
                          </span>
                          <div className="stat-row-metric">
                            <strong>{percent(pair.winRate)}</strong>
                            <WinRateTrend
                              {...trendPeriod}
                              current={comparison.current.partnerships.find(
                                ({ teammateId }) => teammateId === pair.teammateId,
                              )}
                              previous={comparison.previous.partnerships.find(
                                ({ teammateId }) => teammateId === pair.teammateId,
                              )}
                            />
                          </div>
                        </div>
                        <div className="contribution-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.round((pair.playerShare ?? 0) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="contribution-copy">
                          {player ? `${player.screenName}'s points` : "Your points"}:{" "}
                          {pair.playerPoints} ({percent(pair.playerShare)}) ·{" "}
                          {displayName(names, pair.teammateId)}: {pair.teammatePoints} (
                          {percent(pair.teammateShare)})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
