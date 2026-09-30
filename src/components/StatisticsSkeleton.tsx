import { Skeleton } from "./Skeleton";
import type { StatisticsPlayer } from "#/domain/views";
import { PlayerAvatar } from "./PlayerAvatar";

type PlayerHeadingProps = { player?: StatisticsPlayer; onBack?: () => void };

export function StatisticsHeading({ player, onBack }: PlayerHeadingProps) {
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
        <p className="muted">All-time statistics</p>
      </div>
      {onBack && (
        <button className="button button-quiet" onClick={onBack} type="button">
          Back to Players
        </button>
      )}
    </div>
  );
}

export function StatisticsSkeleton({
  hasMatches,
  player,
  onBack,
}: { hasMatches: boolean } & PlayerHeadingProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading statistics"
      className="page-section"
      role="status"
    >
      <StatisticsHeading player={player} onBack={onBack} />
      <div aria-hidden="true">
        <div className="stats-overview">
          {[
            "Match win rate",
            "Individual Round credits",
            "Current streak",
            "Total time played",
          ].map((label, index) => (
            <article className={`stat-card${index === 0 ? " stat-featured" : ""}`} key={label}>
              <span className="muted">{label}</span>
              <strong className="stat-value">
                <Skeleton width="55%" />
                {index !== 2 && (
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
          <div className="stats-grid">
            {[
              {
                title: "By map",
                description: "Ranked by win rate · sample size shown",
                map: true,
                partnership: false,
              },
              {
                title: "Against opponents",
                description: "Teammates are excluded",
                map: false,
                partnership: false,
              },
              {
                title: "With teammates",
                description: "Match results and individual points credited to each Player",
                map: false,
                partnership: true,
              },
            ].map((panel) => (
              <section className="panel stats-panel" key={panel.title}>
                <div className="panel-heading">
                  <div>
                    <h2>{panel.title}</h2>
                    <p className="muted">{panel.description}</p>
                  </div>
                </div>
                <div className="stat-list">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div className={panel.partnership ? "partnership-row" : undefined} key={index}>
                      <div className="stat-row">
                        <span className="stat-player skeleton-stat-player">
                          <Skeleton
                            className={panel.map ? "skeleton-map" : "skeleton-player-avatar"}
                          />
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
                      {panel.partnership && (
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
            ))}
            <section className="panel stats-panel streak-panel">
              <div className="panel-heading">
                <div>
                  <h2>Streaks</h2>
                  <p className="muted">Ordered by completion time, then Match ID</p>
                  <p className="muted">Daily streaks use your local calendar days.</p>
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
          </div>
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
