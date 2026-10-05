import type { MapView, MatchView, RoundView } from "#/domain/views";
import { ApiError, apiMessage, apiRequest } from "#/lib/api";
import { formatDuration } from "#/lib/time";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { MapPicker } from "./MapPicker";
import { RoundTimeline } from "./RoundTimeline";
import { ScoreEmblems } from "./ScoreEmblems";
import { useToast } from "./ToastProvider";

type PendingScore = {
  revision: number;
  submissionId: string;
  winnerCompetitorId: string;
  survivingPlayerIds: string[];
};

const SCORE_COOLDOWN_MS = 5_000;

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
  const pausedAt = match.pausedAt ? Date.parse(match.pausedAt) : now;
  const elapsedMilliseconds =
    now -
    Date.parse(match.startedAt) -
    match.pausedDurationSeconds * 1000 -
    (match.pausedAt ? now - pausedAt : 0);
  return formatDuration(Math.max(0, Math.floor(elapsedMilliseconds / 1000)));
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
  const nextScoreAllowedAt = useRef(0);
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
  const [canKeepScreenAwake, setCanKeepScreenAwake] = useState(false);
  const [keepScreenAwake, setKeepScreenAwake] = useState(true);
  const toast = useToast();

  const isScorekeeper = match.creatorId === viewerId;
  const editable =
    (match.status === "active" && match.pausedAt === null) || match.status === "awaiting-map";

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
    setCanKeepScreenAwake(
      navigator.maxTouchPoints > 0 &&
        window.matchMedia("(pointer: coarse)").matches &&
        "wakeLock" in navigator,
    );
  }, []);

  useEffect(() => {
    if (!canKeepScreenAwake || !keepScreenAwake) return;
    const wakeLockApi = navigator.wakeLock;
    if (!wakeLockApi) return;

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquireWakeLock() {
      if (cancelled || wakeLock || document.visibilityState !== "visible") return;
      try {
        const acquired = await wakeLockApi.request("screen");
        if (cancelled) {
          await acquired.release();
          return;
        }
        wakeLock = acquired;
        acquired.addEventListener("release", () => {
          if (wakeLock === acquired) wakeLock = null;
        });
      } catch (error: unknown) {
        if (cancelled) return;
        setKeepScreenAwake(false);
        const reason = error instanceof Error ? ` ${error.message}` : "";
        toast(`Your browser could not keep the screen awake.${reason}`, "warning");
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquireWakeLock();
    };
    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        void wakeLock.release().catch(() => {
          toast("The screen wake lock could not be released.", "warning");
        });
      }
    };
  }, [canKeepScreenAwake, keepScreenAwake, toast]);

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
          nextScoreAllowedAt.current = 0;
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
    if (!isScorekeeper || matchRef.current.status !== "active") {
      return;
    }
    const now = Date.now();
    if (now < nextScoreAllowedAt.current) {
      toast(
        "Double scoring was prevented. Wait 5 seconds before recording another point.",
        "error",
      );
      return;
    }
    if (pendingScoreRef.current) return;

    nextScoreAllowedAt.current = now + SCORE_COOLDOWN_MS;
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

  async function togglePause() {
    setActionPending(true);
    setActionError("");
    try {
      const result = await apiRequest<{ match: MatchView }>(`/api/matches/${match.id}/pause`, {
        method: "POST",
        body: JSON.stringify({
          paused: match.pausedAt === null,
          revision: match.revision,
        }),
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

  async function repeatMatchWithoutMap() {
    if (!isScorekeeper || match.status !== "completed" || actionPending || saveState !== "idle") {
      return;
    }
    setActionPending(true);
    setActionError("");
    try {
      const result = await apiRequest<{ match: MatchView }>("/api/matches", {
        method: "POST",
        body: JSON.stringify({
          competitors: match.competitors.map(({ playerIds }) => ({ playerIds })),
          mapId: null,
          gameModes: match.gameModes,
        }),
      });
      applyMatch(result.match);
    } catch (error) {
      setActionError(apiMessage(error));
      if (error instanceof ApiError) {
        const latest = matchFromPayload(error.payload);
        if (latest) applyMatch(latest);
      } else {
        setConnection(online ? "error" : "offline");
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
          {isScorekeeper && match.status === "active" && (
            <button
              className="button button-quiet"
              disabled={actionPending || saveState !== "idle"}
              onClick={() => void togglePause()}
              type="button"
            >
              {match.pausedAt ? "Resume match" : "Pause match"}
            </button>
          )}
          {canKeepScreenAwake && (match.status === "active" || match.status === "awaiting-map") && (
            <label className="match-wake-lock">
              <input
                checked={keepScreenAwake}
                onChange={(event) => setKeepScreenAwake(event.currentTarget.checked)}
                type="checkbox"
              />
              Keep screen awake
            </label>
          )}
        </div>
      </section>

      {match.pausedAt && (
        <div className="notice notice-warning" role="status">
          The match is paused.{" "}
          {isScorekeeper ? "Resume it to continue scoring." : "Scoring is paused."}
        </div>
      )}
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
          <strong>{winnerName(match)}</strong> won the match. Round points are kept separately from
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
                    src={player.avatar ?? "/resources/heroes/SpeedRunner/SpeedRunner_Original.png"}
                  />
                  <div className="match-player-meta">
                    <strong>{player.screenName}</strong>
                  </div>
                  {isScorekeeper && match.status === "active" && !match.pausedAt && (
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
            {competitor.kind === "team" &&
              isScorekeeper &&
              match.status === "active" &&
              !match.pausedAt && (
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
            {activeRoundCount(match.rounds) === 1 ? "" : "s"} scored
          </span>
        </summary>
        {match.rounds.length === 0 ? (
          <p className="empty-inline">No round has been recorded yet.</p>
        ) : (
          <RoundTimeline
            competitors={match.competitors}
            endLabel={formatElapsed(match, now)}
            rounds={match.rounds}
            startedAt={match.startedAt}
          />
        )}
      </details>

      {match.status === "completed" && (
        <div className="completed-match-actions">
          {isScorekeeper && (
            <button
              className="button button-quiet"
              disabled={actionPending || saveState !== "idle"}
              onClick={() => void repeatMatchWithoutMap()}
              type="button"
            >
              Repeat setup without map
            </button>
          )}
          <button
            className="button button-primary"
            disabled={actionPending || saveState !== "idle"}
            onClick={onDone}
            type="button"
          >
            Done
          </button>
        </div>
      )}

      <MapPicker
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
