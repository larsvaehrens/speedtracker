import type { CompletedMatch } from "./types";
import { getCompetitorScore } from "./scoring";
import {
  EMPTY_MATCH_FILTERS,
  matchesFilters,
  precedingDateRange,
  type MatchFilters,
} from "./match-filters";

export type MapStat = {
  mapId: string;
  name: string;
  imagePath: string;
  order: number;
  wins: number;
  matches: number;
  winRate: number;
  totalPlayedSeconds: number;
  averageMatchSeconds: number;
  shortestMatchSeconds: number;
  longestMatchSeconds: number;
};

export type OpponentStat = {
  playerId: string;
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
};

export type PartnershipStat = {
  teammateId: string;
  wins: number;
  matches: number;
  winRate: number;
  playerPoints: number;
  teammatePoints: number;
  playerShare: number | null;
  teammateShare: number | null;
};

export type Streak = {
  length: number;
  firstMatchId: string | null;
  lastMatchId: string | null;
};

export type PlayerStatistics = {
  matchWins: number;
  matchesPlayed: number;
  matchWinRate: number | null;
  roundCredits: number;
  totalPlayedSeconds: number;
  flawlessWins: number;
  shutoutLosses: number;
  maps: MapStat[];
  opponents: OpponentStat[];
  partnerships: PartnershipStat[];
  currentStreak: { kind: "win" | "loss" | "none"; length: number };
  longestWinStreak: Streak;
  longestLossStreak: Streak;
  playingDayStreak: { current: number; longest: number };
  monthlyComparison: {
    currentMonth: string;
    previousMonth: string;
    current: MonthlyStatistics;
    previous: MonthlyStatistics;
  };
};

export type MonthlyStatistics = Pick<
  PlayerStatistics,
  | "matchWinRate"
  | "matchesPlayed"
  | "roundCredits"
  | "totalPlayedSeconds"
  | "maps"
  | "opponents"
  | "partnerships"
>;

type StatisticsOptions = { timeZone: string; now?: Date; filters?: MatchFilters };

type MapDetails = {
  id: string;
  name: string;
  imagePath: string;
  order: number;
};

type Outcome = {
  id: string;
  completedAt: string;
  won: boolean;
};

type MutableStreak = {
  length: number;
  firstMatchId: string;
  lastMatchId: string;
};

function winRate(wins: number, matches: number): number | null {
  return matches === 0 ? null : wins / matches;
}

function sumPlayerPoints(matches: CompletedMatch[], playerId: string): number {
  return matches.reduce(
    (total, match) =>
      total +
      match.rounds
        .filter((round) => !round.undone)
        .flatMap((round) => round.attributions)
        .filter((attribution) => attribution.playerId === playerId)
        .reduce((points, attribution) => points + attribution.points, 0),
    0,
  );
}

function getMatchDurationSeconds(match: CompletedMatch): number {
  return Math.max(
    0,
    Math.floor(
      (Date.parse(match.completedAt) -
        Date.parse(match.startedAt) -
        match.pausedDurationSeconds * 1000) /
        1000,
    ),
  );
}

function compareRateThenSample(
  left: { winRate: number; matches: number },
  right: { winRate: number; matches: number },
): number {
  return right.winRate - left.winRate || right.matches - left.matches;
}

function streakFrom(outcomes: Outcome[], won: boolean): Streak {
  let longest: MutableStreak | null = null;
  let current: MutableStreak | null = null;

  for (const outcome of outcomes) {
    if (outcome.won !== won) {
      current = null;
      continue;
    }

    if (!current) {
      current = {
        length: 1,
        firstMatchId: outcome.id,
        lastMatchId: outcome.id,
      };
    } else {
      current.length += 1;
      current.lastMatchId = outcome.id;
    }

    if (!longest || current.length > longest.length) {
      longest = { ...current };
    }
  }

  return longest
    ? {
        length: longest.length,
        firstMatchId: longest.firstMatchId,
        lastMatchId: longest.lastMatchId,
      }
    : { length: 0, firstMatchId: null, lastMatchId: null };
}

function getPlayingDayStreak(
  matches: CompletedMatch[],
  timeZone: string,
  now: Date,
): PlayerStatistics["playingDayStreak"] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function calendarDay(date: Date): number {
    const parts = Object.fromEntries(
      formatter.formatToParts(date).map(({ type, value }) => [type, value]),
    );
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000;
  }

  const days = [...new Set(matches.map((match) => calendarDay(new Date(match.completedAt))))].sort(
    (left, right) => left - right,
  );
  let current = 0;
  let longest = 0;
  let previous: number | undefined;
  for (const day of days) {
    current = previous !== undefined && day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }

  const today = calendarDay(now);
  if (previous !== today && previous !== today - 1) current = 0;
  return { current, longest };
}

function getPartnershipStats(playerId: string, matches: CompletedMatch[]): PartnershipStat[] {
  const partnershipMatches = new Map<string, CompletedMatch[]>();

  for (const match of matches) {
    const competitor = match.competitors.find(({ playerIds }) => playerIds.includes(playerId));
    if (!competitor || competitor.playerIds.length !== 2) continue;

    const teammateId = competitor.playerIds.find((id) => id !== playerId);
    if (!teammateId) continue;

    const teamMatches = partnershipMatches.get(teammateId) ?? [];
    teamMatches.push(match);
    partnershipMatches.set(teammateId, teamMatches);
  }

  return [...partnershipMatches.entries()]
    .map(([teammateId, teamMatches]) => {
      const wins = teamMatches.filter(
        (match) =>
          match.competitors.find(({ playerIds }) => playerIds.includes(playerId))?.id ===
          match.winnerCompetitorId,
      ).length;
      const playerPoints = sumPlayerPoints(teamMatches, playerId);
      const teammatePoints = sumPlayerPoints(teamMatches, teammateId);
      const totalPoints = playerPoints + teammatePoints;

      return {
        teammateId,
        wins,
        matches: teamMatches.length,
        winRate: wins / teamMatches.length,
        playerPoints,
        teammatePoints,
        playerShare: totalPoints === 0 ? null : playerPoints / totalPoints,
        teammateShare: totalPoints === 0 ? null : teammatePoints / totalPoints,
      };
    })
    .sort(
      (left, right) =>
        compareRateThenSample(left, right) || left.teammateId.localeCompare(right.teammateId),
    );
}

function calculateBaseStatistics(
  playerId: string,
  completedMatches: CompletedMatch[],
  mapDetails: MapDetails[],
  options: StatisticsOptions,
): Omit<PlayerStatistics, "monthlyComparison"> {
  const matches = completedMatches
    .filter((match) => match.competitors.some(({ playerIds }) => playerIds.includes(playerId)))
    .sort(
      (left, right) =>
        left.completedAt.localeCompare(right.completedAt) || left.id.localeCompare(right.id),
    );

  const outcomes = matches.map((match) => ({
    id: match.id,
    completedAt: match.completedAt,
    won: match.competitors.some(
      ({ id, playerIds }) => playerIds.includes(playerId) && id === match.winnerCompetitorId,
    ),
  }));
  const matchWins = outcomes.filter((outcome) => outcome.won).length;

  const mapStats = new Map<string, MapStat>();
  const opponentStats = new Map<string, { wins: number; losses: number; matches: number }>();
  const mapsById = new Map(mapDetails.map((map) => [map.id, map]));
  let flawlessWins = 0;
  let shutoutLosses = 0;

  for (const match of matches) {
    const ownCompetitor = match.competitors.find(({ playerIds }) => playerIds.includes(playerId));
    if (!ownCompetitor) continue;
    const ownScore = getCompetitorScore(match, ownCompetitor.id);
    const opponentScore = match.competitors
      .filter(({ id }) => id !== ownCompetitor.id)
      .reduce((total, competitor) => total + getCompetitorScore(match, competitor.id), 0);
    const won = ownCompetitor.id === match.winnerCompetitorId;
    if (won && opponentScore === 0) flawlessWins += 1;
    if (!won && ownScore === 0) shutoutLosses += 1;

    const map = mapsById.get(match.mapId);
    if (map) {
      const duration = getMatchDurationSeconds(match);
      const stat = mapStats.get(map.id) ?? {
        mapId: map.id,
        name: map.name,
        imagePath: map.imagePath,
        order: map.order,
        wins: 0,
        matches: 0,
        winRate: 0,
        totalPlayedSeconds: 0,
        averageMatchSeconds: 0,
        shortestMatchSeconds: duration,
        longestMatchSeconds: duration,
      };
      stat.matches += 1;
      stat.totalPlayedSeconds += duration;
      stat.averageMatchSeconds = Math.round(stat.totalPlayedSeconds / stat.matches);
      stat.shortestMatchSeconds = Math.min(stat.shortestMatchSeconds, duration);
      stat.longestMatchSeconds = Math.max(stat.longestMatchSeconds, duration);
      if (ownCompetitor.id === match.winnerCompetitorId) stat.wins += 1;
      stat.winRate = stat.wins / stat.matches;
      mapStats.set(map.id, stat);
    }

    for (const competitor of match.competitors) {
      if (competitor.id === ownCompetitor.id) continue;
      for (const opponentId of competitor.playerIds) {
        const stat = opponentStats.get(opponentId) ?? {
          wins: 0,
          losses: 0,
          matches: 0,
        };
        stat.matches += 1;
        if (ownCompetitor.id === match.winnerCompetitorId) {
          stat.wins += 1;
        } else {
          stat.losses += 1;
        }
        opponentStats.set(opponentId, stat);
      }
    }
  }

  const currentOutcome = outcomes.at(-1);
  const currentKind = currentOutcome ? (currentOutcome.won ? "win" : "loss") : "none";
  let currentStreak = 0;
  for (let index = outcomes.length - 1; index >= 0; index -= 1) {
    if (
      (currentKind === "win" && !outcomes[index]?.won) ||
      (currentKind === "loss" && outcomes[index]?.won)
    ) {
      break;
    }
    currentStreak += 1;
  }

  return {
    matchWins,
    matchesPlayed: matches.length,
    matchWinRate: winRate(matchWins, matches.length),
    roundCredits: sumPlayerPoints(matches, playerId),
    totalPlayedSeconds: matches.reduce((total, match) => total + getMatchDurationSeconds(match), 0),
    flawlessWins,
    shutoutLosses,
    maps: [...mapStats.values()].sort(
      (left, right) =>
        compareRateThenSample(left, right) ||
        left.order - right.order ||
        left.name.localeCompare(right.name),
    ),
    opponents: [...opponentStats.entries()]
      .map(([opponentId, stat]) => ({
        playerId: opponentId,
        ...stat,
        winRate: stat.wins / stat.matches,
      }))
      .sort(
        (left, right) =>
          compareRateThenSample(left, right) || left.playerId.localeCompare(right.playerId),
      ),
    partnerships: getPartnershipStats(playerId, matches),
    currentStreak: { kind: currentKind, length: currentStreak },
    longestWinStreak: streakFrom(outcomes, true),
    longestLossStreak: streakFrom(outcomes, false),
    playingDayStreak: getPlayingDayStreak(matches, options.timeZone, options.now ?? new Date()),
  };
}

export function calculateStatistics(
  playerId: string,
  completedMatches: CompletedMatch[],
  mapDetails: MapDetails[],
  options: StatisticsOptions = { timeZone: "UTC" },
): PlayerStatistics {
  const now = options.now ?? new Date();
  const filters = options.filters ?? EMPTY_MATCH_FILTERS;
  const calendar = new Intl.DateTimeFormat("en-US", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  function localTimestamp(date: Date): number {
    // Encode local calendar fields as UTC values to compare matching wall-clock cutoffs.
    const parts = Object.fromEntries(
      calendar.formatToParts(date).map(({ type, value }) => [type, value]),
    );
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
      date.getUTCMilliseconds(),
    );
  }
  const localNow = new Date(localTimestamp(now));
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const currentStart = Date.UTC(year, month, 1);
  const previousStart = Date.UTC(year, month - 1, 1);
  const previousMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const previousEnd =
    localNow.getUTCDate() > previousMonthDays
      ? currentStart
      : Date.UTC(
          year,
          month - 1,
          localNow.getUTCDate(),
          localNow.getUTCHours(),
          localNow.getUTCMinutes(),
          localNow.getUTCSeconds(),
          localNow.getUTCMilliseconds(),
        );
  const filtersWithoutDates = { ...filters, startDate: "", endDate: "" };
  const currentMatches: CompletedMatch[] = [];
  const previousMatches: CompletedMatch[] = [];
  const selectedMatches = completedMatches.filter((match) =>
    matchesFilters(match, playerId, filters, options.timeZone),
  );
  if (filters.startDate && filters.endDate) {
    const previousRange = precedingDateRange(filters);
    for (const match of completedMatches) {
      if (match.completedAt && Date.parse(match.completedAt) > now.getTime()) continue;
      if (
        matchesFilters(
          match,
          playerId,
          { ...filtersWithoutDates, ...previousRange },
          options.timeZone,
        )
      ) {
        previousMatches.push(match);
      }
    }
    currentMatches.push(...selectedMatches);
  } else if (filters.startDate || filters.endDate) {
    currentMatches.push(...selectedMatches);
  } else {
    for (const match of completedMatches) {
      const completedAt = new Date(match.completedAt);
      if (completedAt.getTime() > now.getTime()) continue;
      const localTime = localTimestamp(completedAt);
      if (localTime >= currentStart) {
        if (matchesFilters(match, playerId, filtersWithoutDates, options.timeZone)) {
          currentMatches.push(match);
        }
      } else if (
        localTime >= previousStart &&
        (previousEnd === currentStart || localTime <= previousEnd)
      ) {
        if (matchesFilters(match, playerId, filtersWithoutDates, options.timeZone)) {
          previousMatches.push(match);
        }
      }
    }
  }
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  const rangeLabel = (startDate: string, endDate: string) => {
    const dateFormat = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${dateFormat.format(new Date(`${startDate}T00:00:00Z`))} – ${dateFormat.format(
      new Date(`${endDate}T00:00:00Z`),
    )}`;
  };
  const comparisonCurrentLabel =
    filters.startDate || filters.endDate
      ? filters.startDate && filters.endDate
        ? rangeLabel(filters.startDate, filters.endDate)
        : "Selected date range"
      : monthLabel.format(new Date(currentStart));
  const comparisonDateRange =
    filters.startDate && filters.endDate ? precedingDateRange(filters) : null;
  const comparisonPreviousLabel = comparisonDateRange
    ? rangeLabel(comparisonDateRange.startDate, comparisonDateRange.endDate)
    : filters.startDate || filters.endDate
      ? "Previous matching range"
      : monthLabel.format(new Date(previousStart));
  const fixedOptions = { ...options, now };
  function monthlyStatistics(matches: CompletedMatch[]): MonthlyStatistics {
    const stats = calculateBaseStatistics(playerId, matches, mapDetails, fixedOptions);
    return {
      matchWinRate: stats.matchWinRate,
      matchesPlayed: stats.matchesPlayed,
      roundCredits: stats.roundCredits,
      totalPlayedSeconds: stats.totalPlayedSeconds,
      maps: stats.maps,
      opponents: stats.opponents,
      partnerships: stats.partnerships,
    };
  }
  return {
    ...calculateBaseStatistics(playerId, selectedMatches, mapDetails, fixedOptions),
    monthlyComparison: {
      currentMonth: comparisonCurrentLabel,
      previousMonth: comparisonPreviousLabel,
      current: monthlyStatistics(currentMatches),
      previous: monthlyStatistics(previousMatches),
    },
  };
}
