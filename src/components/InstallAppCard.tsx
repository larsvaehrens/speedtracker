import { useEffect, useState } from "react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isAppleMobile(): boolean {
  const userAgent = navigator.userAgent;
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(userAgent) || isIPadOS;
}

export function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsIOS(isAppleMobile());
    setIsInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          (navigator as Navigator & { standalone?: boolean }).standalone === true),
    );

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    setInstalling(true);
    setError("");
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setIsInstalled(true);
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : "The install prompt could not be opened.",
      );
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section className="panel install-panel">
      <div>
        <p className="eyebrow">App-like experience</p>
        <h2>Use SpeedTracker without browser bars</h2>
        <p className="muted">
          Add SpeedTracker to your Home Screen, then open it from its icon. It will launch in its
          own window without the browser address bar.
        </p>
      </div>

      {isInstalled ? (
        <p className="install-instructions" role="status">
          SpeedTracker is installed. Open it from your Home Screen for the fullscreen app view.
        </p>
      ) : (
        <>
          {installPrompt && (
            <button
              className="button button-primary install-button"
              disabled={installing}
              onClick={() => void install()}
              type="button"
            >
              {installing ? "Opening install prompt…" : "Install SpeedTracker"}
            </button>
          )}
          <p className="install-instructions">
            {isIOS
              ? "On iPhone or iPad: in Safari, tap Share, choose Add to Home Screen, then tap Add. Open SpeedTracker from the new Home Screen icon."
              : "On Android: in Chrome, open the ⋮ menu and choose Install app (or Add to Home screen). Then launch SpeedTracker from its new icon."}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
