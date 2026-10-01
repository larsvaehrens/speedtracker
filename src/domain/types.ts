import type { GameMode } from "./game-modes";

export type MatchStatus = "active" | "awaiting-map" | "completed" | "abandoned";

export type Competitor = {
  id: string;
  playerIds: string[];
};

export type PointAttribution = {
  playerId: string;
  points: number;
};

export type RoundResult = {
  id: string;
  submissionId: string;
  sequence: number;
  winnerCompetitorId: string;
  survivingPlayerIds: string[];
  attributions: PointAttribution[];
  undone: boolean;
};

export type MatchState = {
  id: string;
  revision: number;
  status: MatchStatus;
  mapId: string | null;
  startedAt: string;
  completedAt: string | null;
  winnerCompetitorId: string | null;
  gameModes: GameMode[];
  competitors: Competitor[];
  rounds: RoundResult[];
};

export type CompletedMatch = MatchState & {
  status: "completed";
  mapId: string;
  completedAt: string;
  winnerCompetitorId: string;
};
