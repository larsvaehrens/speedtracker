import { Skeleton } from "./Skeleton";
import type { StatisticsPlayer } from "#/domain/views";
import { PlayerAvatar } from "./PlayerAvatar";

type PlayerHeadingProps = {
  player?: StatisticsPlayer;
  onBack?: () => void;
  isFriend?: boolean;
  friendPending?: boolean;
  onToggleFriend?: () => void;
};

function StatisticsPanelSkeleton({
  title,
  description,
  map = false,
  partnership = false,
}: {
  title: string;
  description: string;
  map?: boolean;
  partnership?: boolean;
}) {
  return (
    <section className="panel stats-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="stat-list">
        {Array.from({ length: 3 }, (_, index) => (
          <div className={partnership ? "partnership-row" : undefined} key={index}>
            {!map && (
              <div className="stat-row">
                <span className="stat-player skeleton-stat-player">
                  <Skeleton className="skeleton-player-avatar" />
                  <span className="stat-row-title skeleton-stat-title">
                    <strong>
                      <Skeleton width="75%" />
                    </strong>
                    <small>
                      <Skeleton />
                    </small>
                  </span>
                </span>
                <div className="stat-row-metric">
                  <strong>
                    <Skeleton width={40} />
                  </strong>
                  <span className="stat-trend">
                    <Skeleton width={50} />
                  </span>
                </div>
              </div>
            )}
            {map && (
              <div className="map-stat-row">
                <Skeleton className="skeleton-map map-stat-thumbnail" />
                <div className="map-stat-content">
                  <div className="map-stat-heading">
                    <span className="map-stat-title skeleton-stat-title">
                      <strong>
                        <Skeleton width="75%" />
                      </strong>
                      <small>
                        <Skeleton />
                      </small>
                    </span>
                    <div className="stat-row-metric">
                      <Skeleton width={40} />
                    </div>
                  </div>
                  <div className="map-time-metrics">
                    {["Total time", "Avg match", "Shortest", "Longest"].map((label) => (
                      <span className="map-time-metric" key={label}>
                        <span className="map-time-metric-label">{label}</span>
                        <Skeleton width={55} />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {partnership && (
              <>
                <div className="contribution-bar">
                  <Skeleton height="100%" />
                </div>
                <p className="contribution-copy">
                  <Skeleton height="1.45em" />
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function StatisticsHeading({
  player,
  onBack,
  isFriend,
  friendPending,
  onToggleFriend,
}: PlayerHeadingProps) {
  return (
    <div className="section-heading statistics-heading">
      <div>
        {player ? (
          <div className="statistics-player-heading">
            <PlayerAvatar avatar={player.avatar} />
            <h1>{player.screenName}'s statistics</h1>
          </div>
        ) : (
          <h1>Statistics</h1>
        )}
      </div>
      {player && onToggleFriend && (
        <button
          className={isFriend ? "button button-quiet" : "button button-primary"}
          disabled={friendPending}
          onClick={onToggleFriend}
          type="button"
        >
          {friendPending ? "Updating…" : isFriend ? "Remove friend" : "Add friend"}
        </button>
      )}
      {onBack && (
        <button className="button button-quiet" onClick={onBack} type="button">
          Back to players
        </button>
      )}
    </div>
  );
}

export function StatisticsSkeleton({
  hasMatches,
  player,
  onBack,
  isFriend,
  friendPending,
  onToggleFriend,
}: { hasMatches: boolean } & PlayerHeadingProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading statistics"
      className="page-section"
      role="status"
    >
      <StatisticsHeading
        player={player}
        onBack={onBack}
        isFriend={isFriend}
        friendPending={friendPending}
        onToggleFriend={onToggleFriend}
      />
      <div aria-hidden="true">
        <div className="match-filters panel">
          <div className="match-filter-controls">
            <div className="match-filter-grid">
              {["Date range", "Maps", "Teammates", "Opponents"].map((label) => (
                <div className="skeleton-filter-control" key={label}>
                  <Skeleton height="48px" />
                </div>
              ))}
            </div>
            {["Game modes"].map((label) => (
              <div className="skeleton-filter-control" key={label}>
                <Skeleton height="48px" />
              </div>
            ))}
          </div>
        </div>
        <div className="stats-overview">
          {[
            "Match win rate",
            "Individual points",
            "Flawless wins",
            "Shutout losses",
            "Total time played",
          ].map((label, index) => (
            <article
              className={`stat-card${index === 0 ? " stat-featured" : index === 2 ? " stat-card-positive" : index === 3 ? " stat-card-negative" : ""}`}
              key={label}
            >
              <span className="muted">{label}</span>
              <strong className="stat-value">
                <Skeleton width="55%" />
                {[0, 1, 4].includes(index) && (
                  <span className="stat-trend">
                    <Skeleton width={45} />
                  </span>
                )}
              </strong>
              <span>
                <Skeleton height="1.45em" />
              </span>
            </article>
          ))}
        </div>
        {hasMatches ? (
          <>
            <section className="panel stats-panel streak-panel">
              <div className="panel-heading">
                <div>
                  <h2>Streaks</h2>
                </div>
              </div>
              <div className="streak-grid">
                {[
                  "Current",
                  "Longest winning",
                  "Longest losing",
                  "Daily playing streak",
                  "Longest playing streak",
                ].map((label) => (
                  <div key={label}>
                    <span className="muted">{label}</span>
                    <strong>
                      <Skeleton width="65%" />
                    </strong>
                  </div>
                ))}
              </div>
            </section>
            <div className="stats-grid">
              <StatisticsPanelSkeleton title="By map" description="Ranked by win rate" map />
              <div className="stats-side-panels">
                <StatisticsPanelSkeleton
                  title="Against opponents"
                  description="Teammates are excluded"
                />
                <StatisticsPanelSkeleton
                  title="With teammates"
                  description="Match results and individual points scored by each player"
                  partnership
                />
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state panel skeleton-empty">
            <h2>
              <Skeleton width="75%" />
            </h2>
            <p className="muted">
              <Skeleton />
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
