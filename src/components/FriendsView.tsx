import { useState, type FormEvent } from "react";
import type { FriendView } from "#/domain/views";
import { apiMessage, apiRequest } from "#/lib/api";

type FriendsViewProps = {
  friends: FriendView[];
  onChanged: () => void;
};

export function FriendsView({ friends, onChanged }: FriendsViewProps) {
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function addFollow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<{ follows: FriendView[] }>("/api/follows", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      setUsername("");
      setNotice("Player added. They can now be selected for your Setups.");
      onChanged();
    } catch (addError) {
      setError(apiMessage(addError));
    } finally {
      setPending(false);
    }
  }

  async function removeFollow(player: FriendView) {
    setError("");
    try {
      await apiRequest<{ follows: FriendView[] }>(`/api/follows/${player.id}`, {
        method: "DELETE",
      });
      onChanged();
    } catch (removeError) {
      setError(apiMessage(removeError));
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">One-way follows</p>
          <h1>Players</h1>
          <p className="muted">
            Add someone by their exact login username. Following only makes them selectable in your
            Setups; it does not open their private data.
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
            {pending ? "Adding…" : "Add Player"}
          </button>
        </form>
        {notice && <p className="inline-notice">{notice}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="subsection">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Your list</p>
            <h2>Followed Players ({friends.length})</h2>
          </div>
        </div>
        {friends.length === 0 ? (
          <p className="empty-inline panel">
            No followed Players yet. Add someone by their login username.
          </p>
        ) : (
          <ul className="friend-list">
            {friends.map((friend) => (
              <li className="friend-row panel" key={friend.id}>
                <img
                  alt=""
                  className="player-avatar"
                  src={friend.avatar ?? "/ressources/heroes/SpeedRunner/SpeedRunner_Original.png"}
                />
                <span className="friend-name">
                  <strong>{friend.screenName}</strong>
                  <small>@{friend.username}</small>
                </span>
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
