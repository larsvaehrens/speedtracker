export function MapThumbnail({ imagePath }: { imagePath: string }) {
  return (
    <img alt="" className="map-thumbnail" height={50} loading="lazy" src={imagePath} width={80} />
  );
}
