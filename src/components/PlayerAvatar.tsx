export function PlayerAvatar({ avatar }: { avatar: string | null }) {
  return (
    <img
      alt=""
      className="player-avatar"
      src={avatar ?? "/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"}
    />
  );
}
