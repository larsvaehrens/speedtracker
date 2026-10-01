import type { MatchState, PointAttribution } from "./types";

export type PlayerView = {
  id: string;
  username: string;
  screenName: string;
  avatar: string | null;
};

export type StatisticsPlayer = Pick<PlayerView, "id" | "screenName" | "avatar">;

export type MapView = {
  id: string;
  name: string;
  imagePath: string;
  order: number;
};

export type RoundView = {
  id: string;
  submissionId: string;
  sequence: number;
  winnerCompetitorId: string;
  survivingPlayerIds: string[];
  attributions: PointAttribution[];
  undone: boolean;
};

export type CompetitorView = {
  id: string;
  kind: "solo" | "team";
  sortOrder: number;
  playerIds: string[];
  players: PlayerView[];
  score: number;
};

export type MatchView = Omit<MatchState, "competitors" | "rounds"> & {
  creatorId: string;
  map: MapView | null;
  competitors: CompetitorView[];
  rounds: RoundView[];
  durationSeconds: number | null;
};

export type FriendView = PlayerView & { followedAt: string | null };
