import { useEffect, useState } from "react";
import { HERO_AVATARS } from "#/domain/assets";
import type { FriendView } from "#/domain/views";
import { apiMessage, apiRequest } from "#/lib/api";

type ProfileViewProps = {
  user: FriendView;
  onSaved: (user: FriendView) => void;
};

function avatarLabel(path: string): string {
  const filename = path.split("/").at(-1) ?? "Hero";
  return filename.replace(/\.(jpg|png)$/i, "").replaceAll("_", " ");
}

export function ProfileView({ user, onSaved }: ProfileViewProps) {
  const [screenName, setScreenName] = useState(user.screenName);
  const [avatar, setAvatar] = useState<string>(user.avatar ?? HERO_AVATARS[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setScreenName(user.screenName);
    setAvatar(user.avatar ?? HERO_AVATARS[0]);
  }, [user]);

  async function saveProfile() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ user: FriendView }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ screenName, avatar }),
      });
      onSaved({ ...result.user, followedAt: null });
      setNotice("Profile saved.");
    } catch (saveError) {
      setError(apiMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h1>Profile settings</h1>
          <p className="muted">
            Your login username stays fixed. Change your screen name and hero avatar here.
          </p>
        </div>
      </div>

      <section className="panel profile-panel">
        <div className="profile-fields">
          <label>
            Login username
            <input readOnly value={`@${user.username}`} />
          </label>
          <label>
            Screen name
            <input
              maxLength={24}
              minLength={2}
              required
              value={screenName}
              onChange={(event) => setScreenName(event.currentTarget.value)}
            />
          </label>
        </div>
        <div className="avatar-heading">
          <div>
            <h2>Choose your hero</h2>
            <p className="muted">Your avatar is visible to match participants.</p>
          </div>
          <img alt="" className="avatar-preview" src={avatar} />
        </div>
        <div className="avatar-grid">
          {HERO_AVATARS.map((path) => (
            <button
              aria-label={avatarLabel(path)}
              aria-pressed={avatar === path}
              className={`avatar-choice${avatar === path ? " is-selected" : ""}`}
              key={path}
              onClick={() => setAvatar(path)}
              type="button"
            >
              <img alt="" loading="lazy" src={path} />
            </button>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="inline-notice">{notice}</p>}
        <button
          className="button button-primary"
          disabled={pending || screenName.trim().length < 2}
          onClick={() => void saveProfile()}
          type="button"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </section>

      <p className="recovery-note">
        There is no email address or account recovery flow. Keep your username and password safe.
      </p>
    </section>
  );
}
