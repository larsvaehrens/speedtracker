export function PlayerAvatar({ avatar }: { avatar: string | null }) {
  return (
    <img
      alt=""
      className="player-avatar"
      src={avatar ?? "/resources/heroes/SpeedRunner/SpeedRunner_Original.png"}
    />
  );
}
