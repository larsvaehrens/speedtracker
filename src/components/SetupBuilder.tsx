import { useEffect, useMemo, useState } from "react";
import { arrangementKey, validateSetup, type CompetitorSetup } from "#/domain/setup";
import type { FriendView, MapView, MatchView } from "#/domain/views";
import { apiRequest, apiMessage } from "#/lib/api";
import { MapPicker } from "./MapPicker";
import { PlayerSelect } from "./PlayerSelect";
import { MatchCompetitors } from "./MatchCompetitors";
import { MapThumbnail } from "./MapThumbnail";
import { useToast } from "./ToastProvider";
import { DEFAULT_GAME_MODES, GAME_MODES, isGameModes, type GameMode } from "#/domain/game-modes";

const formats = [
  { key: "1-1", label: "1 vs. 1", sizes: [1, 1] },
  { key: "1-1-1", label: "1 vs. 1 vs. 1", sizes: [1, 1, 1] },
  { key: "1-1-1-1", label: "1 vs. 1 vs. 1 vs. 1", sizes: [1, 1, 1, 1] },
  { key: "2-2", label: "2 vs. 2", sizes: [2, 2] },
  { key: "1-2", label: "1 vs. 2", sizes: [1, 2] },
  { key: "1-1-2", label: "1 vs. 1 vs. 2", sizes: [1, 1, 2] },
] as const;

type SetupBuilderProps = {
  user: FriendView;
  players: FriendView[];
  maps: MapView[];
  openMatches: MatchView[];
  onResume: (match: MatchView) => void;
  onMatchCreated: (match: MatchView) => void;
};

function emptySlots(formatKey: string, userId: string): string[][] {
  const format = formats.find(({ key }) => key === formatKey) ?? formats[0];
  return format.sizes.map((size, competitorIndex) =>
    Array.from({ length: size }, (_, memberIndex) =>
      competitorIndex === 0 && memberIndex === 0 ? userId : "",
    ),
  );
}

function isCompetitorList(value: unknown): value is CompetitorSetup[] {
  return (
    Array.isArray(value) &&
    value.every(
      (competitor) =>
        typeof competitor === "object" &&
        competitor !== null &&
        "playerIds" in competitor &&
        Array.isArray(competitor.playerIds) &&
        competitor.playerIds.every((id: unknown) => typeof id === "string"),
    )
  );
}

type PreviousSetup = { competitors: CompetitorSetup[]; gameModes: GameMode[] };

function parsePreviousSetup(value: unknown): PreviousSetup | null {
  if (isCompetitorList(value)) {
    return { competitors: value, gameModes: [...DEFAULT_GAME_MODES] };
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("competitors" in value) ||
    !isCompetitorList(value.competitors) ||
    !("gameModes" in value) ||
    !isGameModes(value.gameModes)
  ) {
    return null;
  }
  return { competitors: value.competitors, gameModes: value.gameModes };
}

export function SetupBuilder({
  user,
  players,
  maps,
  openMatches,
  onResume,
  onMatchCreated,
}: SetupBuilderProps) {
  const eligibleIds = useMemo(() => new Set(players.map((player) => player.id)), [players]);
  const [formatKey, setFormatKey] = useState("1-1");
  const [competitors, setCompetitors] = useState<string[][]>(() => emptySlots("1-1", user.id));
  const [previousSetup, setPreviousSetup] = useState<PreviousSetup | null>(null);
  const [gameModes, setGameModes] = useState<GameMode[]>(() => [...DEFAULT_GAME_MODES]);
  const [mapId, setMapId] = useState<string | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    setCompetitors(emptySlots("1-1", user.id));
    setFormatKey("1-1");
    setGameModes([...DEFAULT_GAME_MODES]);
  }, [user.id]);

  useEffect(() => {
    const key = `speedtracker.previous-setup:${user.id}`;
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      setPreviousSetup(null);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(stored);
      const previous = parsePreviousSetup(parsed);
      if (previous && validateSetup(previous.competitors, user.id, eligibleIds) === null) {
        setPreviousSetup(previous);
      } else {
        window.localStorage.removeItem(key);
        setPreviousSetup(null);
        toast("The previous Setup was no longer available and was cleared.", "warning");
      }
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        window.localStorage.removeItem(key);
        setPreviousSetup(null);
        toast("The saved Setup could not be read and was cleared.", "warning");
      } else {
        throw parseError;
      }
    }
  }, [eligibleIds, user.id, toast]);

  const selectedPlayers = new Set(competitors.flat().filter(Boolean));
  const setup = competitors.map((playerIds) => ({ playerIds }));
  const setupError = validateSetup(setup, user.id, eligibleIds);
  const chosenMap = maps.find((map) => map.id === mapId) ?? null;

  function updatePlayer(competitorIndex: number, memberIndex: number, playerId: string) {
    setCompetitors((current) =>
      current.map((members, index) =>
        index === competitorIndex
          ? members.map((id, member) => (member === memberIndex ? playerId : id))
          : members,
      ),
    );
  }

  function reusePrevious() {
    if (!previousSetup) return;
    const nextKey = arrangementKey(previousSetup.competitors);
    const format = formats.find(({ key }) => key === nextKey);
    if (
      !format ||
      !isGameModes(previousSetup.gameModes) ||
      validateSetup(previousSetup.competitors, user.id, eligibleIds)
    ) {
      setPreviousSetup(null);
      window.localStorage.removeItem(`speedtracker.previous-setup:${user.id}`);
      toast("The previous Setup is no longer valid.", "warning");
      return;
    }

    setFormatKey(format.key);
    setCompetitors(previousSetup.competitors.map(({ playerIds }) => [...playerIds]));
    setGameModes([...previousSetup.gameModes]);
    toast("Previous Setup restored. Start the Match when you are ready.", "success");
  }

  function resetSetup() {
    setFormatKey("1-1");
    setCompetitors(emptySlots("1-1", user.id));
    setMapId(null);
    setPreviousSetup(null);
    setGameModes([...DEFAULT_GAME_MODES]);
    setError("");
    toast("Setup reset.", "success");
    window.localStorage.removeItem(`speedtracker.previous-setup:${user.id}`);
  }

  function savePreviousSetup() {
    if (setupError) return;
    const validSetup = {
      competitors: competitors.map((playerIds) => ({ playerIds })),
      gameModes,
    };
    window.localStorage.setItem(
      `speedtracker.previous-setup:${user.id}`,
      JSON.stringify(validSetup),
    );
    setPreviousSetup(validSetup);
  }

  async function startMatch() {
    if (setupError) {
      setError(`Check the Setup: ${setupError.replaceAll("-", " ")}.`);
      return;
    }
    setError("");
    setStarting(true);
    savePreviousSetup();
    try {
      const result = await apiRequest<{ match: MatchView }>("/api/matches", {
        method: "POST",
        body: JSON.stringify({ competitors: setup, mapId, gameModes }),
      });
      onMatchCreated(result.match);
    } catch (startError) {
      setError(apiMessage(startError));
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading setup-heading">
        <div>
          <h1>Start a match</h1>
        </div>
        <div className="setup-heading-actions">
          <button
            className="button button-quiet"
            disabled={!previousSetup}
            onClick={reusePrevious}
            type="button"
          >
            Reuse last setup
          </button>
          <button className="button button-quiet" onClick={resetSetup} type="button">
            Reset setup
          </button>
        </div>
      </div>

      <section className="panel setup-panel">
        <div className="setup-controls">
          <label>
            Competitor arrangement
            <select
              value={formatKey}
              onChange={(event) => {
                const nextFormat = event.currentTarget.value;
                setFormatKey(nextFormat);
                setCompetitors(emptySlots(nextFormat, user.id));
              }}
            >
              {formats.map((format) => (
                <option key={format.key} value={format.key}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <div className="map-setup">
            <span className="field-label">Map</span>
            <button
              className="button button-map"
              onClick={() => setMapPickerOpen(true)}
              type="button"
            >
              {chosenMap ? (
                <>
                  <img alt="" src={chosenMap.imagePath} />
                  {chosenMap.name}
                </>
              ) : (
                "Choose later"
              )}
            </button>
          </div>
        </div>

        <fieldset className="game-mode-options">
          <legend>Game modes</legend>
          <div className="game-mode-grid">
            {GAME_MODES.map((mode) => (
              <label className="game-mode-option" key={mode}>
                <input
                  checked={gameModes.includes(mode)}
                  onChange={() =>
                    setGameModes((current) =>
                      current.includes(mode)
                        ? current.filter((selected) => selected !== mode)
                        : [...current, mode],
                    )
                  }
                  type="checkbox"
                />
                <span>{mode}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="competitor-setup-grid">
          {competitors.map((members, competitorIndex) => (
            <fieldset className="competitor-setup" key={competitorIndex}>
              <legend>
                Competitor {competitorIndex + 1}
                {members.length === 2 ? " · Team" : " · Solo"}
              </legend>
              {members.map((playerId, memberIndex) => (
                <PlayerSelect
                  key={memberIndex}
                  label={members.length === 2 ? `Team member ${memberIndex + 1}` : "Player"}
                  players={players}
                  selectedPlayers={selectedPlayers}
                  userId={user.id}
                  value={playerId}
                  onChange={(nextPlayerId) =>
                    updatePlayer(competitorIndex, memberIndex, nextPlayerId)
                  }
                />
              ))}
            </fieldset>
          ))}
        </div>

        {players.length <= 1 && (
          <p className="empty-inline">
            Follow Players by their exact login username to invite them into a Setup.
          </p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="setup-actions">
          <p className="muted">
            {setupError
              ? "Select 2–4 distinct players, including yourself."
              : "Assignments lock when the match starts."}
          </p>
          <button
            className="button button-primary button-start"
            disabled={starting || setupError !== null}
            onClick={startMatch}
            type="button"
          >
            {starting ? "Starting…" : "Start match"}
          </button>
        </div>
      </section>

      {openMatches.length > 0 && (
        <section className="subsection">
          <div className="section-heading compact-heading">
            <div>
              <h2>Active matches</h2>
            </div>
          </div>
          <div className="open-match-list">
            {openMatches.map((match) => (
              <button
                className="open-match-card history-card panel"
                key={match.id}
                onClick={() => onResume(match)}
                type="button"
              >
                <span className="history-top">
                  <span className="history-map">
                    {match.map && <MapThumbnail imagePath={match.map.imagePath} />}
                    <span>
                      <span className="result-label">
                        {match.status === "awaiting-map" ? "Map needed" : "Active match"}
                      </span>
                      <span className="open-match-title">
                        {match.map?.name ?? "Map not selected"}
                      </span>
                    </span>
                  </span>
                </span>
                <MatchCompetitors match={match} />
              </button>
            ))}
          </div>
        </section>
      )}

      <MapPicker
        maps={maps}
        onClose={() => setMapPickerOpen(false)}
        onSelect={(nextMapId) => {
          setMapId(nextMapId);
          setMapPickerOpen(false);
        }}
        open={mapPickerOpen}
        selectedMapId={mapId}
      />
    </section>
  );
}
