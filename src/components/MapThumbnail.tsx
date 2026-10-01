export function MapThumbnail({
  imagePath,
  className = "map-thumbnail",
}: {
  imagePath: string;
  className?: string;
}) {
  return <img alt="" className={className} height={50} loading="lazy" src={imagePath} width={80} />;
}
