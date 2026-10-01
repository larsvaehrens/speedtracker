import { useCallback, useEffect, useRef, useState } from "react";
import type { MapView, MatchView, RoundView } from "#/domain/views";
import { apiMessage, apiRequest, ApiError } from "#/lib/api";
import { formatDuration } from "#/lib/time";
import { MapPicker } from "./MapPicker";
import { ScoreEmblems } from "./ScoreEmblems";
import { Icon } from "./Icon";

type PendingScore = {
  revision: number;
  submissionId: string;
  winnerCompetitorId: string;
  survivingPlayerIds: string[];
};

type MatchBoardProps = {
  initialMatch: MatchView;
  maps: MapView[];
  viewerId: string;
  onMatchChanged: (match: MatchView) => void;
  onDone: () => void;
};

function activeRoundCount(rounds: RoundView[]): number {
  return rounds.filter((round) => !round.undone).length;
}

function winnerName(match: MatchView): string {
  return (
    match.competitors
      .find(({ id }) => id === match.winnerCompetitorId)
      ?.players.map(({ screenName }) => screenName)
      .join(" + ") ?? "Competitor"
  );
}

function formatElapsed(match: MatchView, now: number): string {
  if (match.durationSeconds !== null) return formatDuration(match.durationSeconds);
  const startedAt = Date.parse(match.startedAt);
  return formatDuration(Math.floor((now - startedAt) / 1000));
}

function roundDescription(match: MatchView, round: RoundView): string {
  const competitor = match.competitors.find(({ id }) => id === round.winnerCompetitorId);
  const winner = competitor?.players.map(({ screenName }) => screenName).join(" + ");
  const credited = round.attributions
    .map((attribution) => {
      const player = competitor?.players.find(({ id }) => id === attribution.playerId);
      return `${player?.screenName ?? "Player"} +${attribution.points}`;
    })
    .join(", ");
  return `${winner ?? "Competitor"} won · ${credited}`;
}

function matchFromPayload(payload: Record<string, unknown>): MatchView | null {
  const match = payload.match;
  return typeof match === "object" && match !== null ? (match as MatchView) : null;
}

export function MatchBoard({
  initialMatch,
  maps,
  viewerId,
  onMatchChanged,
  onDone,
}: MatchBoardProps) {
  const [match, setMatch] = useState(initialMatch);
  const matchRef = useRef(initialMatch);
  const pendingScoreRef = useRef<PendingScore | null>(null);
  const postInFlight = useRef(false);
  const pollInFlight = useRef(false);
  const [connection, setConnection] = useState<"saved" | "checking" | "offline" | "error">("saved");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "retry">("idle");
  const [saveError, setSaveError] = useState("");
  const [online, setOnline] = useState(true);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [abandonPromptOpen, setAbandonPromptOpen] = useState(false);
  const [correctionPromptOpen, setCorrectionPromptOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(Date.now());

  const isScorekeeper = match.creatorId === viewerId;
  const editable = match.status === "active" || match.status === "awaiting-map";

  const applyMatch = useCallback(
    (nextMatch: MatchView) => {
      matchRef.current = nextMatch;
      setMatch(nextMatch);
      onMatchChanged(nextMatch);
    },
    [onMatchChanged],
  );

  const refresh = useCallback(async () => {
    if (pollInFlight.current) return;
    pollInFlight.current = true;
    setConnection("checking");
    try {
      const result = await apiRequest<{ match: MatchView }>(`/api/matches/${matchRef.current.id}`);
      applyMatch(result.match);

      const pending = pendingScoreRef.current;
      if (
        pending &&
        result.match.rounds.some((round) => round.submissionId === pending.submissionId)
      ) {
        pendingScoreRef.current = null;
        setSaveState("idle");
        setSaveError("");
      } else if (pending && !postInFlight.current) {
        setSaveState("retry");
      }
      setConnection("saved");
    } catch {
      setConnection(online ? "error" : "offline");
    } finally {
      pollInFlight.current = false;
    }
  }, [applyMatch, online]);

  useEffect(() => {
    matchRef.current = initialMatch;
    setMatch(initialMatch);
  }, [initialMatch]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void refresh();
    };
    const handleOffline = () => {
      setOnline(false);
      setConnection("offline");
    };
    const poll = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(poll, 2000);
    setOnline(navigator.onLine);
    if (!navigator.onLine) setConnection("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (match.status === "awaiting-map" && isScorekeeper) {
      setMapPickerOpen(true);
    }
  }, [isScorekeeper, match.status]);

  async function sendPendingScore() {
    const pending = pendingScoreRef.current;
    if (!pending || postInFlight.current) return;

    postInFlight.current = true;
    setSaveState("saving");
    setSaveError("");
    try {
      const result = await apiRequest<{ match: MatchView }>(
        `/api/matches/${matchRef.current.id}/rounds`,
        {
          method: "POST",
          body: JSON.stringify(pending),
        },
      );
      pendingScoreRef.current = null;
      setSaveState("idle");
      setConnection("saved");
      applyMatch(result.match);
    } catch (error) {
      if (error instanceof ApiError) {
        const latest = matchFromPayload(error.payload);
        if (latest) applyMatch(latest);
        setSaveError(error.message);
        if (error.status >= 500) {
          setSaveState("retry");
          setConnection(online ? "error" : "offline");
          void refresh();
        } else {
          pendingScoreRef.current = null;
          setSaveState("idle");
          setConnection("saved");
        }
      } else {
        setSaveState("retry");
        setSaveError(apiMessage(error));
        setConnection(online ? "error" : "offline");
        void refresh();
      }
    } finally {
      postInFlight.current = false;
    }
  }

  function awardRound(competitorId: string, survivingPlayerIds: string[]) {
    if (!isScorekeeper || matchRef.current.status !== "active" || pendingScoreRef.current) {
      return;
    }

    pendingScoreRef.current = {
      revision: matchRef.current.revision,
      submissionId: crypto.randomUUID(),
      winnerCompetitorId: competitorId,
      survivingPlayerIds,
    };
    void sendPendingScore();
  }

  async function chooseMap(mapId: string | null) {
    setMapPickerOpen(false);
    if (!mapId || !isScorekeeper) return;
    setActionPending(true);
    setActionError("");
    try {
      const result = await apiRequest<{ match: MatchView }>(`/api/matches/${match.id}`, {
        method: "PATCH",
        body: JSON.stringify({ mapId, revision: match.revision }),
      });
      applyMatch(result.match);
    } catch (error) {
      setActionError(apiMessage(error));
      if (error instanceof ApiError) {
        const latest = matchFromPayload(error.payload);
        if (latest) applyMatch(latest);
      } else {
        setConnection(online ? "error" : "offline");
        void refresh();
      }
    } finally {
      setActionPending(false);
    }
  }

  async function undoLast(correction = false) {
    setCorrectionPromptOpen(false);
    setActionPending(true);
    setActionError("");
    try {
      const result = await apiRequest<{ match: MatchView }>(`/api/matches/${match.id}/undo`, {
        method: "POST",
        body: JSON.stringify({ revision: match.revision, correction }),
      });
      applyMatch(result.match);
    } catch (error) {
      setActionError(apiMessage(error));
      if (error instanceof ApiError) {
        const latest = matchFromPayload(error.payload);
        if (latest) applyMatch(latest);
      } else {
        setConnection(online ? "error" : "offline");
        void refresh();
      }
    } finally {
      setActionPending(false);
    }
  }

  async function abandonMatch() {
    setAbandonPromptOpen(false);
    setActionPending(true);
    setActionError("");
    try {
      const result = await apiRequest<{ match: MatchView }>(`/api/matches/${match.id}/abandon`, {
        method: "POST",
        body: JSON.stringify({ revision: match.revision }),
      });
      applyMatch(result.match);
      onDone();
    } catch (error) {
      setActionError(apiMessage(error));
      if (error instanceof ApiError) {
        const latest = matchFromPayload(error.payload);
        if (latest) applyMatch(latest);
      } else {
        setConnection(online ? "error" : "offline");
        void refresh();
      }
    } finally {
      setActionPending(false);
    }
  }

  const savedLabel =
    connection === "offline"
      ? "Offline · not saved"
      : connection === "error"
        ? "Connection issue · not confirmed"
        : saveState === "saving"
          ? "Saving result…"
          : saveState === "retry"
            ? "Result not confirmed"
            : connection === "checking"
              ? "Checking connection…"
              : "All changes saved";

  return (
    <section className="page-section match-page">
      <div className="match-topline">
        <button
          className="button button-quiet"
          disabled={actionPending || saveState !== "idle"}
          onClick={onDone}
          type="button"
        >
          <Icon name="arrow-left" />
          Matches
        </button>
        <span className={`save-status save-${connection}`} role="status">
          <Icon name="status-dot" size={12} /> {savedLabel}
        </span>
      </div>

      <section className="match-banner panel">
        <div>
          <h1>{match.map?.name ?? "Map not selected"}</h1>
          {match.map ? (
            isScorekeeper && editable ? (
              <button className="map-preview" onClick={() => setMapPickerOpen(true)} type="button">
                <img alt="" src={match.map.imagePath} />
                Change map
              </button>
            ) : (
              <div className="map-preview map-preview-static">
                <img alt="" src={match.map.imagePath} />
                {match.map.name}
              </div>
            )
          ) : isScorekeeper && editable ? (
            <button
              className={`button ${match.status === "awaiting-map" ? "button-primary" : "button-quiet"}`}
              onClick={() => setMapPickerOpen(true)}
              type="button"
            >
              {match.status === "awaiting-map"
                ? "Choose a map to finish this match"
                : "Choose map (optional)"}
            </button>
          ) : (
            <p className="muted">Map not selected</p>
          )}
        </div>
        <div className="match-clock">
          <span className="muted">Elapsed</span>
          <strong>{formatElapsed(match, now)}</strong>
        </div>
      </section>

      {match.status === "awaiting-map" && (
        <div className="notice notice-warning" role="alert">
          The winning round is saved.{" "}
          {isScorekeeper
            ? "Select a map to finalize this match; your score will remain here while you choose."
            : "The match creator must select a map to finalize it."}
        </div>
      )}
      {match.status === "completed" && (
        <div className="notice notice-success">
          <strong>{winnerName(match)}</strong> won the match. Round credits are kept separately from
          match wins.
        </div>
      )}
      {match.status === "abandoned" && (
        <div className="notice notice-info">
          This match was abandoned and does not count as a loss.
        </div>
      )}

      {saveState === "retry" && (
        <div className="notice notice-warning" role="alert">
          <span>
            {saveError || "The result is still pending confirmation."} It is not shown as saved.
          </span>
          <button
            className="button button-primary"
            disabled={!online}
            onClick={() => void sendPendingScore()}
            type="button"
          >
            Retry save
          </button>
        </div>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="competitor-board">
        {match.competitors.map((competitor) => (
          <article
            className={`competitor-card${competitor.id === match.winnerCompetitorId ? " is-winner" : ""}`}
            key={competitor.id}
          >
            <div className="competitor-heading">
              <span className="eyebrow">
                {competitor.kind === "team" ? "Team" : "Solo"} {competitor.sortOrder + 1}
              </span>
              <strong className="competitor-score">{competitor.score}</strong>
            </div>
            <div className="competitor-players">
              {competitor.players.map((player) => (
                <div className="match-player" key={player.id}>
                  <img
                    alt=""
                    className="player-avatar"
                    src={player.avatar ?? "/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"}
                  />
                  <div className="match-player-meta">
                    <strong>{player.screenName}</strong>
                  </div>
                  {isScorekeeper && match.status === "active" && (
                    <button
                      aria-label={
                        competitor.kind === "team"
                          ? `Only ${player.screenName} survives · +1 team point`
                          : `${player.screenName} won round · +1 point`
                      }
                      className="button button-score"
                      disabled={
                        actionPending || saveState !== "idle" || !online || connection === "offline"
                      }
                      onClick={() => awardRound(competitor.id, [player.id])}
                      type="button"
                    >
                      <ScoreEmblems score={competitor.score} points={1} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {competitor.kind === "team" && isScorekeeper && match.status === "active" && (
              <button
                aria-label={`${competitor.players.map(({ screenName }) => screenName).join(" and ")} both survive · +1 each / +2 team points`}
                className="button button-team"
                disabled={
                  actionPending || saveState !== "idle" || !online || connection === "offline"
                }
                onClick={() =>
                  awardRound(
                    competitor.id,
                    competitor.players.map(({ id }) => id),
                  )
                }
                type="button"
              >
                <ScoreEmblems score={competitor.score} points={2} />
              </button>
            )}
            {competitor.id === match.winnerCompetitorId && (
              <span className="winner-tag">Match winner</span>
            )}
          </article>
        ))}
      </div>

      {isScorekeeper && (
        <div className="score-actions panel">
          <button
            className="button button-undo"
            disabled={
              !editable ||
              actionPending ||
              saveState !== "idle" ||
              activeRoundCount(match.rounds) === 0
            }
            onClick={() => void undoLast()}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              focusable="false"
              height={20}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
              width={20}
            >
              <path d="m9 4-5 5 5 5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
            Undo last result
          </button>
          {match.status === "completed" && match.rounds.some((round) => !round.undone) && (
            <button
              className="button button-quiet"
              onClick={() => setCorrectionPromptOpen(true)}
              type="button"
            >
              Correct final result
            </button>
          )}
          {editable && (
            <button
              className="button button-danger"
              disabled={actionPending || saveState !== "idle"}
              onClick={() => setAbandonPromptOpen(true)}
              type="button"
            >
              Abandon match
            </button>
          )}
        </div>
      )}

      {!isScorekeeper && (
        <p className="notice notice-info">
          You are viewing the live score. Only the match creator can enter or correct results.
        </p>
      )}

      <details className="round-log panel" open>
        <summary>
          <span>Round results</span>
          <span className="muted">
            {activeRoundCount(match.rounds)} round
            {activeRoundCount(match.rounds) === 1 ? "" : "s"} credited
          </span>
        </summary>
        {match.rounds.length === 0 ? (
          <p className="empty-inline">No round has been recorded yet.</p>
        ) : (
          <ol className="round-list">
            {match.rounds.map((round) => (
              <li className={round.undone ? "round-undone" : ""} key={round.id}>
                <span className="round-number">R{round.sequence}</span>
                <span>{roundDescription(match, round)}</span>
                {round.undone && <span className="muted">Undone</span>}
              </li>
            ))}
          </ol>
        )}
      </details>

      {match.status === "completed" && (
        <button
          className="button button-primary button-full"
          disabled={actionPending || saveState !== "idle"}
          onClick={onDone}
          type="button"
        >
          Done
        </button>
      )}

      <MapPicker
        allowMissing={match.status !== "awaiting-map"}
        maps={maps}
        onClose={() => setMapPickerOpen(false)}
        onSelect={(mapId) => {
          if (mapId === null) {
            setMapPickerOpen(false);
            return;
          }
          void chooseMap(mapId);
        }}
        open={mapPickerOpen}
        selectedMapId={match.mapId}
      />

      {abandonPromptOpen && (
        <ConfirmDialog
          title="Abandon this match?"
          message="The score will be kept for reference, but this match will not count as a loss or appear in completed-match statistics."
          confirmLabel="Abandon match"
          onCancel={() => setAbandonPromptOpen(false)}
          onConfirm={() => void abandonMatch()}
        />
      )}
      {correctionPromptOpen && (
        <ConfirmDialog
          title="Correct the final result?"
          message="This will reopen the match and undo its most recent round. Score entry will be enabled again."
          confirmLabel="Reopen and undo"
          onCancel={() => setCorrectionPromptOpen(false)}
          onConfirm={() => void undoLast(true)}
        />
      )}
    </section>
  );
}

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog panel"
        role="dialog"
      >
        <h2 id="confirm-title">{title}</h2>
        <p className="muted">{message}</p>
        <div className="confirm-actions">
          <button className="button button-quiet" onClick={onCancel} type="button">
            Keep match
          </button>
          <button className="button button-danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
