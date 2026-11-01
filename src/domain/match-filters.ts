import type { MatchState } from "./types";
import type { GameMode } from "./game-modes";

export type MatchFilters = {
  startDate: string;
  endDate: string;
  mapIds: string[];
  teammateIds: string[];
  opponentIds: string[];
  gameModes: GameMode[];
};

export type MatchDateRange = { startDate: string; endDate: string };
export type DatePreset =
  | "today"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year";

export const EMPTY_MATCH_FILTERS: MatchFilters = {
  startDate: "",
  endDate: "",
  mapIds: [],
  teammateIds: [],
  opponentIds: [],
  gameModes: [],
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function localDate(date: Date): string {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

function shiftDate(date: Date, days: number): Date {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function getDatePresetRange(preset: DatePreset, now = new Date()): MatchDateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = (today.getDay() + 6) % 7;
  let start: Date;
  let end: Date;

  switch (preset) {
    case "today":
      start = today;
      end = today;
      break;
    case "this-week":
      start = shiftDate(today, -dayOfWeek);
      end = today;
      break;
    case "last-week":
      end = shiftDate(today, -dayOfWeek - 1);
      start = shiftDate(end, -6);
      break;
    case "this-month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
      break;
    case "last-month":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "this-quarter": {
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
      start = new Date(today.getFullYear(), quarterMonth, 1);
      end = today;
      break;
    }
    case "last-quarter": {
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
      start = new Date(today.getFullYear(), quarterMonth - 3, 1);
      end = new Date(today.getFullYear(), quarterMonth, 0);
      break;
    }
    case "this-year":
      start = new Date(today.getFullYear(), 0, 1);
      end = today;
      break;
    case "last-year":
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear(), 0, 0);
      break;
  }

  return { startDate: localDate(start), endDate: localDate(end) };
}

export function matchesFilters(
  match: Pick<MatchState, "completedAt" | "mapId" | "competitors" | "gameModes">,
  playerId: string,
  filters: MatchFilters,
  timeZone: string,
): boolean {
  if (filters.startDate || filters.endDate) {
    if (!match.completedAt) return false;
    let formatter = dateFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      dateFormatters.set(timeZone, formatter);
    }
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(match.completedAt)).map(({ type, value }) => [type, value]),
    );
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && date > filters.endDate) return false;
  }

  if (filters.mapIds.length > 0 && (!match.mapId || !filters.mapIds.includes(match.mapId))) {
    return false;
  }
  if (
    filters.gameModes.length > 0 &&
    !filters.gameModes.some((mode) => match.gameModes.includes(mode))
  ) {
    return false;
  }

  const ownCompetitor = match.competitors.find(({ playerIds }) => playerIds.includes(playerId));
  if (!ownCompetitor) return false;
  if (
    filters.teammateIds.length > 0 &&
    !ownCompetitor.playerIds.some((id) => id !== playerId && filters.teammateIds.includes(id))
  ) {
    return false;
  }
  if (
    filters.opponentIds.length > 0 &&
    !match.competitors
      .filter(({ id }) => id !== ownCompetitor.id)
      .some(({ playerIds }) => playerIds.some((id) => filters.opponentIds.includes(id)))
  ) {
    return false;
  }
  return true;
}

export function precedingDateRange(range: MatchDateRange): MatchDateRange {
  const start = new Date(`${range.startDate}T00:00:00Z`);
  const end = new Date(`${range.endDate}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86400000);
  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };
}
