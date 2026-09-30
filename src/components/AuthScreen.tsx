import { internalAuthEmail, validateUsername } from "#/domain/identity";
import { authClient } from "#/server/auth-client";
import { useState, type FormEvent } from "react";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [screenName, setScreenName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validateUsername(username)) {
      setError("Use 3–24 letters, numbers, or underscores for your username.");
      return;
    }
    if (mode === "signup" && screenName.trim().length < 2) {
      setError("Add a screen name with at least 2 characters.");
      return;
    }
    if (password.length < 10 || password.length > 128) {
      setError("Passwords must be between 10 and 128 characters.");
      return;
    }

    setPending(true);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.username({ username, password })
          : await authClient.signUp.email({
              email: internalAuthEmail(username),
              username,
              displayUsername: username,
              name: screenName.trim(),
              password,
            });

      if (result.error) {
        setError(result.error.message ?? "Unable to complete authentication.");
        return;
      }

      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="brand-lockup">
        <img
          alt="SpeedTracker"
          className="brand-title"
          height={255}
          src="/ressources/speedtracker-title.svg"
          width={1100}
        />
      </div>
      <div className="auth-card">
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <p className="muted">Keep the score, remember every round, and settle the rematch.</p>

        <form onSubmit={submit} className="stack-form">
          <label>
            Username
            <input
              autoComplete="username"
              autoCapitalize="none"
              maxLength={24}
              minLength={3}
              required
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
            />
          </label>

          {mode === "signup" && (
            <label>
              Screen name
              <input
                autoComplete="nickname"
                maxLength={24}
                minLength={2}
                required
                value={screenName}
                onChange={(event) => setScreenName(event.currentTarget.value)}
              />
            </label>
          )}

          <label>
            Password
            <input
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              maxLength={128}
              minLength={10}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary button-full" disabled={pending}>
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            type="button"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
        {mode === "signup" && (
          <p className="recovery-note">
            Accounts use a username and password only. There is no email recovery; losing your
            password means losing access to that account.
          </p>
        )}
      </div>
    </section>
  );
}
