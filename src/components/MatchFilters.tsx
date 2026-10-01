import { useEffect, useRef, useState } from "react";
import type { DatePreset, MatchFilters as MatchFiltersValue } from "#/domain/match-filters";
import { getDatePresetRange } from "#/domain/match-filters";
import { PlayerAvatar } from "./PlayerAvatar";
import { MapThumbnail } from "./MapThumbnail";
import { Icon } from "./Icon";
import { GAME_MODES } from "#/domain/game-modes";

type FilterOption = { id: string; label: string; avatar?: string | null; imagePath?: string };

type MatchFiltersProps = {
  value: MatchFiltersValue;
  maps: FilterOption[];
  teammates: FilterOption[];
  opponents: FilterOption[];
  onChange: (filters: MatchFiltersValue) => void;
  onReset: () => void;
  isActive: boolean;
};

const datePresets: { id: DatePreset; label: string }[] = [
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "this-quarter", label: "This quarter" },
  { id: "last-quarter", label: "Last quarter" },
  { id: "this-year", label: "This year" },
  { id: "last-year", label: "Last year" },
];
const gameModeOptions = GAME_MODES.map((mode) => ({ id: mode, label: mode }));

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  open,
  onToggle,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const singularLabel =
    label === "Maps"
      ? "map"
      : label === "Teammates"
        ? "teammate"
        : label === "Game modes"
          ? "game mode"
          : "opponent";
  const summary =
    selected.length === 0
      ? `Any ${singularLabel}`
      : `${selected.length} ${singularLabel}${selected.length === 1 ? "" : "s"}`;
  return (
    <details className="match-filter-multiselect" open={open}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
      >
        <span>{label}</span>
        <strong>{summary}</strong>
      </summary>
      <div className="match-filter-options">
        {options.length === 0 ? (
          <span className="muted">No {label.toLowerCase()} available</span>
        ) : (
          options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label className="match-filter-option" key={option.id}>
                <input
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== option.id)
                        : [...selected, option.id],
                    )
                  }
                  type="checkbox"
                />
                {option.imagePath ? (
                  <MapThumbnail imagePath={option.imagePath} />
                ) : option.avatar !== undefined ? (
                  <PlayerAvatar avatar={option.avatar} />
                ) : null}
                <span>{option.label}</span>
              </label>
            );
          })
        )}
      </div>
    </details>
  );
}

export function MatchFilters({
  value,
  maps,
  teammates,
  opponents,
  onChange,
  onReset,
  isActive,
}: MatchFiltersProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filterControlsRef = useRef<HTMLDivElement>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [openMultiSelect, setOpenMultiSelect] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState({
    startDate: value.startDate,
    endDate: value.endDate,
  });
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (datePickerOpen && !dialog.open) dialog.showModal();
    if (!datePickerOpen && dialog.open) dialog.close();
  }, [datePickerOpen]);

  useEffect(() => {
    if (!openMultiSelect) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !filterControlsRef.current?.contains(event.target)) {
        setOpenMultiSelect(null);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openMultiSelect]);

  function update(patch: Partial<MatchFiltersValue>) {
    onChange({ ...value, ...patch });
  }

  const dateRangeLabel =
    value.startDate && value.endDate
      ? `${formatDate(value.startDate)} – ${formatDate(value.endDate)}`
      : value.startDate
        ? `From ${formatDate(value.startDate)}`
        : value.endDate
          ? `Through ${formatDate(value.endDate)}`
          : "Any date";

  return (
    <section aria-label="Filter matches" className="match-filters panel">
      <div className="match-filter-controls" ref={filterControlsRef}>
        <div className="match-filter-grid">
          <button
            aria-haspopup="dialog"
            className="date-range-trigger"
            onClick={() => {
              setOpenMultiSelect(null);
              setDateDraft({ startDate: value.startDate, endDate: value.endDate });
              setDatePickerOpen(true);
            }}
            type="button"
          >
            <span>Date range</span>
            <strong>{dateRangeLabel}</strong>
          </button>
          <MultiSelect
            label="Maps"
            onChange={(mapIds) => update({ mapIds })}
            options={maps}
            selected={value.mapIds}
            open={openMultiSelect === "Maps"}
            onToggle={() => setOpenMultiSelect((current) => (current === "Maps" ? null : "Maps"))}
          />
          <MultiSelect
            label="Teammates"
            onChange={(teammateIds) => update({ teammateIds })}
            options={teammates}
            selected={value.teammateIds}
            open={openMultiSelect === "Teammates"}
            onToggle={() =>
              setOpenMultiSelect((current) => (current === "Teammates" ? null : "Teammates"))
            }
          />
          <MultiSelect
            label="Opponents"
            onChange={(opponentIds) => update({ opponentIds })}
            options={opponents}
            selected={value.opponentIds}
            open={openMultiSelect === "Opponents"}
            onToggle={() =>
              setOpenMultiSelect((current) => (current === "Opponents" ? null : "Opponents"))
            }
          />
        </div>
        <MultiSelect
          label="Game modes"
          onChange={(selected) =>
            update({ gameModes: GAME_MODES.filter((mode) => selected.includes(mode)) })
          }
          options={gameModeOptions}
          selected={value.gameModes}
          open={openMultiSelect === "Game modes"}
          onToggle={() =>
            setOpenMultiSelect((current) => (current === "Game modes" ? null : "Game modes"))
          }
        />
      </div>
      {isActive && (
        <button className="button button-quiet match-filter-reset" onClick={onReset} type="button">
          Clear filters
        </button>
      )}
      <dialog
        aria-labelledby="date-range-title"
        className="modal date-range-modal"
        onCancel={(event) => {
          event.preventDefault();
          setDatePickerOpen(false);
        }}
        onClose={() => setDatePickerOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setDatePickerOpen(false);
        }}
        ref={dialogRef}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Filter matches</p>
            <h2 id="date-range-title">Date range</h2>
          </div>
          <button
            aria-label="Close date range picker"
            className="icon-button"
            onClick={() => setDatePickerOpen(false)}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>
        <label>
          Date preset
          <select
            aria-label="Date range preset"
            onChange={(event) => {
              const preset = event.currentTarget.value as DatePreset | "";
              if (preset) setDateDraft(getDatePresetRange(preset));
            }}
            value=""
          >
            <option value="">Choose a date preset…</option>
            {datePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <div className="date-range-inputs">
          <label>
            Start date
            <input
              aria-label="Start date"
              max={dateDraft.endDate || undefined}
              onChange={(event) => {
                const startDate = event.currentTarget.value;
                setDateDraft((current) => ({ ...current, startDate }));
              }}
              type="date"
              value={dateDraft.startDate}
            />
          </label>
          <label>
            End date
            <input
              aria-label="End date"
              min={dateDraft.startDate || undefined}
              onChange={(event) => {
                const endDate = event.currentTarget.value;
                setDateDraft((current) => ({ ...current, endDate }));
              }}
              type="date"
              value={dateDraft.endDate}
            />
          </label>
        </div>
        <div className="date-range-actions">
          <button
            className="button button-quiet"
            onClick={() => {
              setDateDraft({ startDate: "", endDate: "" });
              update({ startDate: "", endDate: "" });
              setDatePickerOpen(false);
            }}
            type="button"
          >
            Clear dates
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              update(dateDraft);
              setDatePickerOpen(false);
            }}
            type="button"
          >
            Apply date range
          </button>
        </div>
      </dialog>
    </section>
  );
}
