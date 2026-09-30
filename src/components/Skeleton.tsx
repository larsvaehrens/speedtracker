import type { CSSProperties } from "react";

export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}) {
  return (
    <span aria-hidden="true" className={`skeleton ${className}`.trim()} style={{ width, height }} />
  );
}
