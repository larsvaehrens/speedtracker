import { useState, type FormEvent } from "react";
import type { FriendView, RecommendedFriendView } from "#/domain/views";
import { apiMessage, apiRequest } from "#/lib/api";
import { PlayerAvatar } from "./PlayerAvatar";
import { useToast } from "./ToastProvider";

type FriendsViewProps = {
  friends: FriendView[];
  recommendations: RecommendedFriendView[];
  onChanged: () => Promise<void>;
  onViewStatistics: (player: FriendView) => void;
};

export function FriendsView({
  friends,
  recommendations,
  onChanged,
  onViewStatistics,
}: FriendsViewProps) {
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  async function postFollow(target: string): Promise<boolean> {
    setPending(true);
    setError("");
    try {
      await apiRequest<{ follows: FriendView[] }>("/api/follows", {
        method: "POST",
        body: JSON.stringify({ username: target }),
      });
      toast("Player added. They can now be selected for your setups.", "success");
      await onChanged();
      return true;
    } catch (addError) {
      setError(apiMessage(addError));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function addFollow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await postFollow(username)) setUsername("");
  }

  async function removeFollow(player: FriendView) {
    setError("");
    try {
      await apiRequest<{ follows: FriendView[] }>(`/api/follows/${player.id}`, {
        method: "DELETE",
      });
      await onChanged();
    } catch (removeError) {
      setError(apiMessage(removeError));
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h1>Players</h1>
          <p className="muted">
            Add someone by their exact login username. Click a followed player to view their
            statistics, or select them in your setups.
          </p>
        </div>
      </div>

      <section className="panel follow-panel">
        <form className="follow-form" onSubmit={addFollow}>
          <label>
            Login username
            <input
              autoCapitalize="none"
              autoComplete="off"
              maxLength={24}
              minLength={3}
              pattern="[A-Za-z0-9_]{3,24}"
              placeholder="Exact username"
              required
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
            />
          </label>
          <button className="button button-primary" disabled={pending}>
            {pending ? "Adding…" : "Add player"}
          </button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {recommendations.length > 0 && (
        <section className="subsection">
          <div className="section-heading compact-heading">
            <div>
              <h2>Recommended players</h2>
              <p className="muted">Friends of your friends.</p>
            </div>
          </div>
          <ul className="friend-list">
            {recommendations.map((player) => (
              <li className="friend-row panel" key={player.id}>
                <div className="friend-profile">
                  <PlayerAvatar avatar={player.avatar} />
                  <span className="friend-name">
                    <strong>{player.screenName}</strong>
                    <small>
                      @{player.username} · {player.mutualCount} mutual{" "}
                      {player.mutualCount === 1 ? "friend" : "friends"}
                    </small>
                  </span>
                </div>
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={() => void postFollow(player.username)}
                  type="button"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="subsection">
        <div className="section-heading compact-heading">
          <div>
            <h2>Followed players ({friends.length})</h2>
          </div>
        </div>
        {friends.length === 0 ? (
          <p className="empty-inline panel">
            No followed players yet. Add someone by their login username.
          </p>
        ) : (
          <ul className="friend-list">
            {friends.map((friend) => (
              <li className="friend-row panel" key={friend.id}>
                <button
                  aria-label={`View ${friend.screenName}'s statistics`}
                  className="friend-profile"
                  onClick={() => onViewStatistics(friend)}
                  type="button"
                >
                  <PlayerAvatar avatar={friend.avatar} />
                  <span className="friend-name">
                    <strong>{friend.screenName}</strong>
                    <small>@{friend.username}</small>
                  </span>
                </button>
                <button
                  className="button button-quiet"
                  onClick={() => void removeFollow(friend)}
                  type="button"
                >
                  Unfollow
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
