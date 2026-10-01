import { useEffect, useMemo, useState } from "react";
import type { MatchView } from "#/domain/views";
import {
  EMPTY_MATCH_FILTERS,
  matchesFilters,
  type MatchFilters as MatchFiltersValue,
} from "#/domain/match-filters";
import { apiMessage, apiRequest } from "#/lib/api";
import { formatDuration } from "#/lib/time";
import { PlayerIdentity } from "./PlayerIdentity";
import { MapThumbnail } from "./MapThumbnail";
import { Icon } from "./Icon";
import { MatchCompetitors } from "./MatchCompetitors";
import { MatchFilters } from "./MatchFilters";

type HistoryViewProps = {
  matches: MatchView[];
  viewerId: string;
  onOpen: (match: MatchView) => void;
};

export function HistoryView({ matches, viewerId, onOpen }: HistoryViewProps) {
  const [allMatches, setAllMatches] = useState(matches);
  const [filters, setFilters] = useState<MatchFiltersValue>(EMPTY_MATCH_FILTERS);
  const [error, setError] = useState("");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ matches: MatchView[] }>("/api/history")
      .then((result) => {
        if (!cancelled) setAllMatches(result.matches);
      })
      .catch((loadError) => {
        if (!cancelled) setError(apiMessage(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(() => {
    const maps = new Map<string, { id: string; label: string; imagePath: string }>();
    const teammates = new Map<string, { id: string; label: string; avatar: string | null }>();
    const opponents = new Map<string, { id: string; label: string; avatar: string | null }>();
    for (const match of allMatches) {
      if (match.map) {
        maps.set(match.map.id, {
          id: match.map.id,
          label: match.map.name,
          imagePath: match.map.imagePath,
        });
      }
      const own = match.competitors.find(({ playerIds }) => playerIds.includes(viewerId));
      if (!own) continue;
      for (const player of own.players) {
        if (player.id !== viewerId) {
          teammates.set(player.id, {
            id: player.id,
            label: player.screenName,
            avatar: player.avatar,
          });
        }
      }
      for (const competitor of match.competitors) {
        if (competitor.id === own.id) continue;
        for (const player of competitor.players) {
          opponents.set(player.id, {
            id: player.id,
            label: player.screenName,
            avatar: player.avatar,
          });
        }
      }
    }
    const sorted = (options: Map<string, { id: string; label: string }>) =>
      [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
    return { maps: sorted(maps), teammates: sorted(teammates), opponents: sorted(opponents) };
  }, [allMatches, viewerId]);

  const filteredMatches = allMatches.filter((match) =>
    matchesFilters(match, viewerId, filters, timeZone),
  );
  const filtersActive = Boolean(
    filters.startDate ||
    filters.endDate ||
    filters.mapIds.length ||
    filters.teammateIds.length ||
    filters.opponentIds.length,
  );

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h1>Match history</h1>
          <p className="muted">{filteredMatches.length} completed matches</p>
        </div>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <MatchFilters
        isActive={filtersActive}
        maps={filterOptions.maps}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY_MATCH_FILTERS)}
        opponents={filterOptions.opponents}
        teammates={filterOptions.teammates}
        value={filters}
      />
      {filteredMatches.length === 0 ? (
        <div className="empty-state panel">
          <Icon className="empty-icon" name="clock" size={32} />
          <h2>
            {allMatches.length === 0
              ? "No completed matches yet"
              : filtersActive
                ? "No matches match these filters"
                : "No completed matches yet"}
          </h2>
          <p className="muted">
            {allMatches.length === 0
              ? "Completed matches will show the map, final scores, duration, match outcome, and every credited Round here."
              : "Try adjusting or clearing your selected filters."}
          </p>
        </div>
      ) : (
        <div className="history-list">
          {filteredMatches.map((match) => {
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
                  <span className="duration-pill">
                    {formatDuration(match.durationSeconds ?? 0)}
                  </span>
                </div>
                <MatchCompetitors match={match} />
                <div className="history-rounds-container">
                  <details className="history-rounds">
                    <summary>
                      Round breakdown · {match.rounds.filter((round) => !round.undone).length}{" "}
                      credited
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
                    View match
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
