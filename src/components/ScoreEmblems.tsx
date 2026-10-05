export function ScoreEmblems({ score, points }: { score: number; points: 1 | 2 }) {
  return (
    <span aria-hidden="true" className="score-emblems">
      {Array.from({ length: points }, (_, index) => (
        <img
          alt=""
          className="score-emblem"
          height={128}
          key={index}
          src={`/resources/emblems/emblem-${score + index + 1}.png`}
          width={128}
        />
      ))}
    </span>
  );
}
