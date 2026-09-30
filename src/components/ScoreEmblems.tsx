import { TEAM_VICTORY_THRESHOLD } from "#/domain/scoring";

export function ScoreEmblems({ score, points }: { score: number; points: 1 | 2 }) {
  return (
    <span aria-hidden="true" className="score-emblems">
      {Array.from({ length: points }, (_, index) => (
        <img
          alt=""
          className="score-emblem"
          height={128}
          key={index}
          src={`/ressources/emblems/emblem-${Math.min(score + index + 1, TEAM_VICTORY_THRESHOLD)}.svg`}
          width={128}
        />
      ))}
    </span>
  );
}
