import { useEffect, useMemo, useState } from "react";
import { arrangementKey, validateSetup, type CompetitorSetup } from "#/domain/setup";
import type { FriendView, MapView, MatchView } from "#/domain/views";
import { apiRequest, apiMessage } from "#/lib/api";
import { MapPicker } from "./MapPicker";
import { PlayerSelect } from "./PlayerSelect";
import { PlayerIdentity } from "./PlayerIdentity";

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

function roundCredits(match: MatchView, playerId: string): number {
  return match.rounds
    .filter((round) => !round.undone)
    .flatMap((round) => round.attributions)
    .filter((attribution) => attribution.playerId === playerId)
    .reduce((total, attribution) => total + attribution.points, 0);
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
  const [previousSetup, setPreviousSetup] = useState<CompetitorSetup[] | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setCompetitors(emptySlots("1-1", user.id));
    setFormatKey("1-1");
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
      if (isCompetitorList(parsed) && validateSetup(parsed, user.id, eligibleIds) === null) {
        setPreviousSetup(parsed);
      } else {
        window.localStorage.removeItem(key);
        setPreviousSetup(null);
        setNotice("The previous Setup was no longer available and was cleared.");
      }
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        window.localStorage.removeItem(key);
        setPreviousSetup(null);
        setNotice("The saved Setup could not be read and was cleared.");
      } else {
        throw parseError;
      }
    }
  }, [eligibleIds, user.id]);

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
    const nextKey = arrangementKey(previousSetup);
    const format = formats.find(({ key }) => key === nextKey);
    if (!format || validateSetup(previousSetup, user.id, eligibleIds)) {
      setPreviousSetup(null);
      window.localStorage.removeItem(`speedtracker.previous-setup:${user.id}`);
      setNotice("The previous Setup is no longer valid.");
      return;
    }

    setFormatKey(format.key);
    setCompetitors(previousSetup.map(({ playerIds }) => [...playerIds]));
    setNotice("Previous Setup restored. Start the Match when you are ready.");
  }

  function resetSetup() {
    setFormatKey("1-1");
    setCompetitors(emptySlots("1-1", user.id));
    setMapId(null);
    setPreviousSetup(null);
    setError("");
    setNotice("Setup reset.");
    window.localStorage.removeItem(`speedtracker.previous-setup:${user.id}`);
  }

  function savePreviousSetup() {
    if (setupError) return;
    const validSetup = competitors.map((playerIds) => ({ playerIds }));
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
        body: JSON.stringify({ competitors: setup, mapId }),
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
      <div className="section-heading">
        <div>
          <h1>Start a Match</h1>
          <p className="muted">
            Choose the competitors now. A map is optional until the Match ends.
          </p>
        </div>
        <button className="button button-quiet" onClick={resetSetup} type="button">
          Reset Setup
        </button>
      </div>

      {previousSetup && (
        <div className="notice notice-info">
          <span>Previous Setup is ready.</span>
          <button className="text-button" onClick={reusePrevious} type="button">
            Reuse last Setup
          </button>
        </div>
      )}
      {notice && <p className="inline-notice">{notice}</p>}

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
              ? "Select 2–4 distinct Players, including yourself."
              : "Assignments lock when the Match starts."}
          </p>
          <button
            className="button button-primary button-start"
            disabled={starting || setupError !== null}
            onClick={startMatch}
            type="button"
          >
            {starting ? "Starting…" : "Start Match"}
          </button>
        </div>
      </section>

      {openMatches.length > 0 && (
        <section className="subsection">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">In progress</p>
              <h2>Open Matches</h2>
            </div>
          </div>
          <div className="open-match-list">
            {openMatches.map((match) => (
              <button
                className="open-match-card"
                key={match.id}
                onClick={() => onResume(match)}
                type="button"
              >
                <span className="open-match-title">
                  {match.map?.name ?? "Map not selected"}
                  {match.status === "awaiting-map" && " · Map needed"}
                </span>
                <span className="open-match-competitors">
                  {match.competitors.map((competitor) => (
                    <span className="open-match-competitor" key={competitor.id}>
                      {competitor.players.map((player) => (
                        <PlayerIdentity key={player.id} player={player}>
                          {player.screenName}
                          <small className="round-credit-line">
                            {roundCredits(match, player.id)} pts
                          </small>
                        </PlayerIdentity>
                      ))}
                      <strong>{competitor.score}</strong>
                    </span>
                  ))}
                </span>
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
