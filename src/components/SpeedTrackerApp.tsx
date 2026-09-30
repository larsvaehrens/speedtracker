import { useCallback, useEffect, useState } from "react";
import { authClient } from "#/server/auth-client";
import type { FriendView, MapView, MatchView } from "#/domain/views";
import { apiMessage, apiRequest } from "#/lib/api";
import { AuthScreen } from "./AuthScreen";
import { FriendsView } from "./FriendsView";
import { HistoryView } from "./HistoryView";
import { MatchBoard } from "./MatchBoard";
import { ProfileView } from "./ProfileView";
import { SetupBuilder } from "./SetupBuilder";
import { StatisticsView } from "./StatisticsView";

type Page = "play" | "history" | "statistics" | "players" | "profile";

type BootstrapData = {
  user: FriendView;
  players: FriendView[];
  maps: MapView[];
  openMatches: MatchView[];
  recentMatches: MatchView[];
};

const pageTabs: { id: Page; label: string }[] = [
  { id: "play", label: "Play" },
  { id: "history", label: "History" },
  { id: "statistics", label: "Statistics" },
  { id: "players", label: "Players" },
  { id: "profile", label: "Profile" },
];

export function SpeedTrackerApp() {
  const session = authClient.useSession();
  const sessionUserId = session.data?.user.id;
  const [page, setPage] = useState<Page>("play");
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchView | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const refreshBootstrap = useCallback(async () => {
    if (!sessionUserId) return;
    setLoading(true);
    setLoadError("");
    try {
      const result = await apiRequest<BootstrapData>("/api/bootstrap");
      setBootstrap(result);
    } catch (error) {
      setLoadError(apiMessage(error));
    } finally {
      setLoading(false);
    }
  }, [sessionUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!sessionUserId) {
      setBootstrap(null);
      setSelectedMatch(null);
      return;
    }

    setLoading(true);
    setLoadError("");
    apiRequest<BootstrapData>("/api/bootstrap")
      .then((result) => {
        if (!cancelled) setBootstrap(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(apiMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const onMatchChanged = useCallback((match: MatchView) => {
    setSelectedMatch(match);
    setBootstrap((current) => {
      if (!current) return current;

      const openMatches =
        match.status === "active" || match.status === "awaiting-map"
          ? [match, ...current.openMatches.filter((openMatch) => openMatch.id !== match.id)]
          : current.openMatches.filter((openMatch) => openMatch.id !== match.id);
      const recentMatches =
        match.status === "completed"
          ? [
              match,
              ...current.recentMatches.filter((recentMatch) => recentMatch.id !== match.id),
            ].slice(0, 30)
          : current.recentMatches;

      return { ...current, openMatches, recentMatches };
    });
  }, []);

  const openMatch = useCallback((match: MatchView) => {
    setSelectedMatch(match);
    setPage("play");
  }, []);

  const doneWithMatch = useCallback(() => {
    setSelectedMatch(null);
    void refreshBootstrap();
  }, [refreshBootstrap]);

  async function signOut() {
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setLoadError(result.error.message ?? "Unable to sign out.");
        setSigningOut(false);
        return;
      }
      window.location.reload();
    } catch (error) {
      setLoadError(apiMessage(error));
      setSigningOut(false);
    }
  }

  if (session.isPending) {
    return <div className="loading-screen">Loading SpeedTracker…</div>;
  }
  if (!session.data?.user) return <AuthScreen />;
  if (loading && !bootstrap) {
    return <div className="loading-screen">Loading your Matches…</div>;
  }
  if (!bootstrap) {
    return (
      <div className="loading-screen">
        <div className="load-error">
          <h1>Could not load SpeedTracker</h1>
          <p role="alert">{loadError || "Your account data is unavailable."}</p>
          <button
            className="button button-primary"
            onClick={() => void refreshBootstrap()}
            type="button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const playerNames = Object.fromEntries(
    bootstrap.players.map((player) => [player.id, player.screenName]),
  );

  function updateProfile(user: FriendView) {
    setBootstrap((current) =>
      current
        ? {
            ...current,
            user,
            players: current.players.map((player) =>
              player.id === user.id ? { ...player, ...user } : player,
            ),
          }
        : current,
    );
    void refreshBootstrap();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          aria-label="SpeedTracker home"
          className="brand-lockup"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            setSelectedMatch(null);
            setPage("play");
          }}
        >
          <span aria-hidden="true" className="brand-mark">
            ST
          </span>
          <span>SpeedTracker</span>
        </a>
        <div className="signed-in">
          <img
            alt=""
            className="signed-in-avatar"
            src={bootstrap.user.avatar ?? "/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"}
          />
          <span>{bootstrap.user.screenName}</span>
          <button
            className="text-button signout-button"
            disabled={signingOut}
            onClick={() => void signOut()}
            type="button"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <nav aria-label="Main navigation" className="main-nav">
        {pageTabs.map((tab) => (
          <button
            aria-current={page === tab.id ? "page" : undefined}
            className={page === tab.id ? "nav-tab is-active" : "nav-tab"}
            key={tab.id}
            onClick={() => {
              setPage(tab.id);
              if (tab.id !== "play") setSelectedMatch(null);
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {loadError && (
        <p className="inline-error" role="alert">
          {loadError}
          <button className="text-button" onClick={() => void refreshBootstrap()} type="button">
            Retry
          </button>
        </p>
      )}

      {page === "play" && selectedMatch && (
        <MatchBoard
          initialMatch={selectedMatch}
          maps={bootstrap.maps}
          onDone={doneWithMatch}
          onMatchChanged={onMatchChanged}
          viewerId={bootstrap.user.id}
        />
      )}
      {page === "play" && !selectedMatch && (
        <SetupBuilder
          maps={bootstrap.maps}
          onMatchCreated={openMatch}
          onResume={openMatch}
          openMatches={bootstrap.openMatches}
          players={bootstrap.players}
          user={bootstrap.user}
        />
      )}
      {page === "history" && (
        <HistoryView
          matches={bootstrap.recentMatches}
          onOpen={openMatch}
          viewerId={bootstrap.user.id}
        />
      )}
      {page === "statistics" && <StatisticsView playerNames={playerNames} />}
      {page === "players" && (
        <FriendsView
          friends={bootstrap.players.filter((player) => player.id !== bootstrap.user.id)}
          onChanged={() => void refreshBootstrap()}
        />
      )}
      {page === "profile" && <ProfileView user={bootstrap.user} onSaved={updateProfile} />}

      <footer className="app-footer">
        Scores are entered by the Match creator. Match participants can view the live score.
      </footer>
    </div>
  );
}
