import { formatPlayedTime } from "#/lib/time";

type StatTrendProps = {
  current: number | null;
  previous: number | null;
  unit: "rate" | "count" | "duration";
  label?: string;
  currentSamples?: number;
  previousSamples?: number;
  currentPeriodLabel?: string;
  comparisonLabel?: string;
};

export function StatTrend({
  current,
  previous,
  unit,
  label,
  currentSamples,
  previousSamples,
  currentPeriodLabel = "this month",
  comparisonLabel = "matched period last month",
}: StatTrendProps) {
  if (current === null || previous === null || previous <= 0 || current === previous) {
    return null;
  }

  function value(value: number | null): string {
    if (value === null) return "no matches";
    if (unit === "rate") return `${Math.round(value * 100)}%`;
    if (unit === "duration") return formatPlayedTime(value);
    return value.toString();
  }

  const rawChange = ((current - previous) / previous) * 100;
  const change = Math.round(rawChange * 10) / 10;
  const direction = rawChange > 0 ? "up" : "down";
  const description = change === 0 ? "<0.1%" : `${change > 0 ? "+" : ""}${change}%`;
  const samples =
    currentSamples !== undefined && previousSamples !== undefined
      ? ` (${currentSamples} matches ${currentPeriodLabel}; ${previousSamples} in the previous period)`
      : "";
  const currentPeriod = samples ? "" : ` (${currentPeriodLabel})`;

  return (
    <span
      className={`stat-trend stat-trend-${direction}`}
      title={`${label ? `${label}: ` : ""}${description} vs ${comparisonLabel} (${value(current)} vs ${value(previous)})${samples}${currentPeriod}`}
    >
      <svg
        aria-hidden="true"
        className={direction === "down" ? "trend-icon trend-icon-down" : "trend-icon"}
        fill="none"
        height={14}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={14}
      >
        <path d="M12 19V5m-5 5 5-5 5 5" />
      </svg>
      <span>{description}</span>
    </span>
  );
}

export function WinRateTrend({
  current,
  previous,
  currentPeriodLabel,
  comparisonLabel,
}: {
  current: { winRate: number; matches: number } | undefined;
  previous: { winRate: number; matches: number } | undefined;
  currentPeriodLabel?: string;
  comparisonLabel?: string;
}) {
  return (
    <StatTrend
      current={current?.winRate ?? null}
      previous={previous?.winRate ?? null}
      unit="rate"
      currentSamples={current?.matches ?? 0}
      previousSamples={previous?.matches ?? 0}
      currentPeriodLabel={currentPeriodLabel}
      comparisonLabel={comparisonLabel}
    />
  );
}
