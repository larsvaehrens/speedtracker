import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";

type ToastKind = "info" | "success" | "warning" | "error";
type Toast = { id: number; message: string; kind: ToastKind };
type Notify = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<Notify | null>(null);

export function useToast(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used within ToastProvider.");
  return notify;
}

function ToastMessage({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hovered || focused || toast.kind === "warning" || toast.kind === "error") return;
    const timer = window.setTimeout(() => dismiss(toast.id), 6000);
    return () => window.clearTimeout(timer);
  }, [dismiss, focused, hovered, toast.id, toast.kind]);

  return (
    <div
      aria-atomic="true"
      className={`toast toast-${toast.kind}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      role={toast.kind === "warning" || toast.kind === "error" ? "alert" : "status"}
    >
      <p>{toast.message}</p>
      <button
        aria-label="Dismiss notification"
        className="toast-close"
        onClick={() => dismiss(toast.id)}
        type="button"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const notify = useCallback<Notify>((message, kind = "info") => {
    const toast = { id: nextId.current++, message, kind };
    setToasts((current) => {
      const next = [...current.filter((item) => item.message !== message), toast];
      const transient = next.filter((item) => item.kind !== "warning").slice(-3);
      return next.filter((item) => item.kind === "warning" || transient.includes(item));
    });
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-label="Notifications" className="toast-viewport" role="region">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
