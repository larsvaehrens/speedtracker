import { Skeleton } from "./Skeleton";
import { AppFooter } from "./AppFooter";

export function AppSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="app-shell" role="status">
      <div aria-hidden="true">
        <header className="app-header">
          <div className="brand-lockup">
            <img
              alt=""
              className="brand-title"
              height={255}
              src="/ressources/speedtracker-title.svg"
              width={1100}
            />
          </div>
          <div className="signed-in">
            <Skeleton className="skeleton-user-avatar" />
            <Skeleton width={80} />
            <Skeleton width={50} />
          </div>
        </header>
        <div className="main-nav">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="nav-tab skeleton-nav-tab" key={index}>
              <Skeleton width="60%" />
            </div>
          ))}
        </div>
        <section className="page-section">
          <div className="section-heading setup-heading">
            <div>
              <p className="eyebrow">Fast setup</p>
              <h1>Start a match</h1>
            </div>
            <div className="setup-heading-actions">
              <Skeleton className="skeleton-button" width={145} />
              <Skeleton className="skeleton-button" width={110} />
            </div>
          </div>
          <section className="panel setup-panel">
            <div className="setup-controls">
              <div className="skeleton-field">
                <span className="field-label">Competitor arrangement</span>
                <Skeleton className="skeleton-input" />
              </div>
              <div className="map-setup">
                <span className="field-label">Map</span>
                <Skeleton className="skeleton-button" />
              </div>
            </div>
            <fieldset className="game-mode-options">
              <legend>Game modes</legend>
              <div aria-hidden="true" className="game-mode-grid">
                {Array.from({ length: 6 }, (_, index) => (
                  <div className="game-mode-option" key={index}>
                    <Skeleton width={18} height={18} />
                    <Skeleton width="70%" />
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="competitor-setup-grid">
              {[1, 2].map((competitor) => (
                <fieldset className="competitor-setup" key={competitor}>
                  <legend>Competitor {competitor} · Solo</legend>
                  <div className="player-select">
                    <span className="field-label">Player</span>
                    <Skeleton height={60} />
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="setup-actions">
              <p className="muted">Select 2–4 distinct players, including yourself.</p>
              <Skeleton className="skeleton-button skeleton-start" />
            </div>
          </section>
        </section>
      </div>
      <AppFooter />
    </div>
  );
}
