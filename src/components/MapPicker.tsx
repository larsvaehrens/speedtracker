import { useEffect, useRef } from "react";
import type { MapView } from "#/domain/views";
import { Icon } from "./Icon";

type MapPickerProps = {
  maps: MapView[];
  selectedMapId: string | null;
  open: boolean;
  allowMissing?: boolean;
  onSelect: (mapId: string | null) => void;
  onClose: () => void;
};

export function MapPicker({
  maps,
  selectedMapId,
  open,
  allowMissing = true,
  onSelect,
  onClose,
}: MapPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-labelledby="map-picker-title"
      className="modal map-modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="modal-heading">
        <div>
          <p className="eyebrow">Map select</p>
          <h2 id="map-picker-title">Choose a map</h2>
        </div>
        <button
          aria-label="Close map selector"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="map-grid">
        {maps.map((map) => (
          <button
            aria-pressed={selectedMapId === map.id}
            className={`map-tile${selectedMapId === map.id ? " is-selected" : ""}`}
            key={map.id}
            onClick={() => onSelect(map.id)}
            type="button"
          >
            <img alt="" loading="lazy" src={map.imagePath} />
            <span>{map.name}</span>
          </button>
        ))}
      </div>
      {allowMissing && (
        <button
          className="button button-quiet map-clear"
          onClick={() => onSelect(null)}
          type="button"
        >
          No map selected
        </button>
      )}
    </dialog>
  );
}
