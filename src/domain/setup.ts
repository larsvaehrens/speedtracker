export type CompetitorSetup = {
  playerIds: string[];
};

export type SetupError =
  | "too-few-players"
  | "too-many-players"
  | "duplicate-player"
  | "invalid-team-size"
  | "unsupported-arrangement"
  | "missing-creator"
  | "unavailable-player";

const supportedArrangements = new Set(["1-1", "1-1-1", "1-1-1-1", "1-1-2", "1-2", "2-2"]);

export function arrangementKey(competitors: CompetitorSetup[]): string {
  return competitors
    .map((competitor) => competitor.playerIds.length)
    .sort((left, right) => left - right)
    .join("-");
}

export function arrangementLabel(competitors: CompetitorSetup[]): string {
  return competitors
    .map((competitor) =>
      competitor.playerIds.length === 1
        ? competitor.playerIds[0]
        : competitor.playerIds.join(" + "),
    )
    .join(" vs. ");
}

export function validateSetup(
  competitors: CompetitorSetup[],
  creatorId: string,
  eligiblePlayerIds: ReadonlySet<string>,
): SetupError | null {
  const playerIds = competitors.flatMap((competitor) => competitor.playerIds);

  if (playerIds.length < 2) return "too-few-players";
  if (playerIds.length > 4) return "too-many-players";
  if (new Set(playerIds).size !== playerIds.length) return "duplicate-player";
  if (competitors.some(({ playerIds: members }) => ![1, 2].includes(members.length))) {
    return "invalid-team-size";
  }
  if (!supportedArrangements.has(arrangementKey(competitors))) {
    return "unsupported-arrangement";
  }
  if (!playerIds.includes(creatorId)) return "missing-creator";
  if (playerIds.some((playerId) => !eligiblePlayerIds.has(playerId))) {
    return "unavailable-player";
  }

  return null;
}
