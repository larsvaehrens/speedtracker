import { useEffect, useId, useRef, useState } from "react";
import type { FriendView } from "#/domain/views";
import { PlayerAvatar } from "./PlayerAvatar";
import { Icon } from "./Icon";

type PlayerSelectProps = {
  label: string;
  players: FriendView[];
  value: string;
  userId: string;
  selectedPlayers: ReadonlySet<string>;
  onChange: (playerId: string) => void;
};

export function PlayerSelect({
  label,
  players,
  value,
  userId,
  selectedPlayers,
  onChange,
}: PlayerSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = players.find((player) => player.id === value);
  const options = [
    { id: "", name: "Select a player", player: null, disabled: false },
    ...players.map((player) => ({
      id: player.id,
      name: `${player.screenName} (@${player.username})${player.id === userId ? " · you" : ""}`,
      player,
      disabled: selectedPlayers.has(player.id) && player.id !== value,
    })),
  ];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [active, id, open]);

  function showOptions() {
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.id === value),
      ),
    );
    searchRef.current = { text: "", time: 0 };
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(direction: number) {
    for (let offset = 1; offset <= options.length; offset++) {
      const next = (active + direction * offset + options.length) % options.length;
      if (!options[next].disabled) {
        setActive(next);
        return;
      }
    }
  }

  return (
    <div
      className="player-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      ref={rootRef}
    >
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        className="player-select-trigger"
        onClick={() => (open ? setOpen(false) : showOptions())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            showOptions();
          }
        }}
        ref={triggerRef}
        type="button"
      >
        {selected && <PlayerAvatar avatar={selected.avatar} />}
        <span id={`${id}-value`}>
          {options.find((option) => option.id === value)?.name ?? "Select a player"}
        </span>
        <Icon className="player-select-arrow" name="chevron-down" />
      </button>
      {open && (
        <div
          aria-activedescendant={`${id}-option-${active}`}
          aria-labelledby={`${id}-label`}
          className="player-select-options"
          id={`${id}-list`}
          onMouseDown={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(event.key === "ArrowDown" ? 1 : -1);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              setActive(
                event.key === "Home"
                  ? 0
                  : options.length -
                      1 -
                      [...options].reverse().findIndex((option) => !option.disabled),
              );
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              choose(active);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            } else if (
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              event.preventDefault();
              const now = Date.now();
              const text =
                (now - searchRef.current.time < 700 ? searchRef.current.text : "") +
                event.key.toLowerCase();
              searchRef.current = { text, time: now };
              const next = options.findIndex(
                (option) => !option.disabled && option.name.toLowerCase().startsWith(text),
              );
              if (next !== -1) setActive(next);
            }
          }}
          ref={listRef}
          role="listbox"
          tabIndex={0}
        >
          {options.map((option, index) => (
            <div
              aria-disabled={option.disabled}
              aria-selected={option.id === value}
              className={`player-select-option${index === active ? " is-active" : ""}`}
              id={`${id}-option-${index}`}
              key={option.id}
              onClick={() => choose(index)}
              role="option"
            >
              {option.player && <PlayerAvatar avatar={option.player.avatar} />}
              <span>{option.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
