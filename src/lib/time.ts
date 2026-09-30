export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function formatPlayedTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds > 0 && seconds < 60) return "< 1 minute";

  const [divisor, unit] =
    seconds >= 86400 ? [86400, "day"] : seconds >= 3600 ? [3600, "hour"] : [60, "minute"];
  const amount = Math.floor((seconds * 10) / divisor) / 10;
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}
