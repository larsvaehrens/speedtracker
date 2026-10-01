import type { GameMode } from "#/domain/game-modes";

export function GameModeBadges({ modes }: { modes: GameMode[] }) {
  return (
    <div aria-label="Enabled game modes" className="game-mode-badges">
      {modes.length > 0 ? (
        modes.map((mode) => (
          <span className="game-mode-badge" key={mode}>
            {mode}
          </span>
        ))
      ) : (
        <span className="muted">No game modes enabled</span>
      )}
    </div>
  );
}
