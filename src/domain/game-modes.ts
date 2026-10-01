export const GAME_MODES = [
  "Sudden Death",
  "Lethal Spikes",
  "srennuRdeepS",
  "SuperSpeedRunners",
  "SpeedRapture",
  "Destructible Environment",
] as const;

export type GameMode = (typeof GAME_MODES)[number];

export const DEFAULT_GAME_MODES: GameMode[] = ["Sudden Death"];

export function isGameModes(value: unknown): value is GameMode[] {
  return (
    Array.isArray(value) &&
    value.every((mode) => typeof mode === "string" && GAME_MODES.includes(mode as GameMode)) &&
    new Set(value).size === value.length
  );
}

export function parseGameModes(value: string): GameMode[] {
  const parsed: unknown = JSON.parse(value);
  if (!isGameModes(parsed)) {
    throw new Error("The stored match has invalid game mode settings.");
  }
  return parsed;
}
