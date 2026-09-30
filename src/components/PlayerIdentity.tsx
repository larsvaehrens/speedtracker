import type { ReactNode } from "react";
import type { PlayerView } from "#/domain/views";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerIdentity({
  player,
  children,
}: {
  player: Pick<PlayerView, "screenName" | "avatar">;
  children?: ReactNode;
}) {
  return (
    <span className="player-identity">
      <PlayerAvatar avatar={player.avatar} />
      <span>{children ?? player.screenName}</span>
    </span>
  );
}
