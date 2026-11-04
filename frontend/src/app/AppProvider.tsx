import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Action, Bridge, Snapshot } from "../bridge/types";
import {
  ConfirmDialog,
  type Confirmation,
} from "../components/ConfirmDialog/ConfirmDialog";
import { Notice } from "../components/Notice/Notice";
import type { Tone } from "../components/Badge/Badge";
import styles from "./App.module.css";
interface Model {
  state: Snapshot;
  bridge: Bridge;
  busy: boolean;
  act(action: Action, payload?: string, success?: string): Promise<boolean>;
  task<T>(work: () => Promise<T>, success?: string): Promise<T | undefined>;
  refresh(): Promise<void>;
  confirm(confirmation: Confirmation): Promise<boolean>;
  dirty: (kind: "settings" | "lists", value: boolean) => void;
  hasEdits(): boolean;
  notify(text: string, tone?: Tone): void;
}
const Context = createContext<Model | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider is required");
  return value;
}
export function AppProvider({
  bridge,
  children,
}: {
  bridge: Bridge;
  children: ReactNode;
}) {
  const [state, setState] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: Tone }>();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const pending = useRef(false);
  const active = useRef(true);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const edits = useRef({ settings: false, lists: false });
  const notify = useCallback(
    (text: string, tone: Tone = "neutral") => setNotice({ text, tone }),
    [],
  );
  const refresh = useCallback(async () => {
    if (pending.current || resolver.current) return;
    pending.current = true;
    try {
      const next = await bridge.Snapshot();
      if (active.current) {
        setState(next);
      }
    } catch (error) {
      if (active.current) notify(String(error), "danger");
    } finally {
      pending.current = false;
    }
  }, [bridge, notify]);
  useEffect(() => {
    active.current = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    const unload = (event: BeforeUnloadEvent) => {
      if (edits.current.settings || edits.current.lists) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("beforeunload", unload);
      resolver.current?.(false);
      resolver.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    if (!state) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        state.config.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : state.config.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state?.config.theme]);
  async function task<T>(
    work: () => Promise<T>,
    success = "",
  ): Promise<T | undefined> {
    if (pending.current || resolver.current) return undefined;
    pending.current = true;
    setBusy(true);
    notify("Выполняется…");
    try {
      const result = await work();
      if (active.current) notify(success, "success");
      return result;
    } catch (error) {
      if (active.current) notify(String(error), "danger");
      try {
        const next = await bridge.Snapshot();
        if (active.current) setState(next);
      } catch {
        /* Keep last known state. */
      }
      return undefined;
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function act(action: Action, payload = "", success = "Готово.") {
    return (
      (await task(async () => {
        const next = await bridge.Action(action, payload);
        if (active.current) setState(next);
        return true;
      }, success)) === true
    );
  }
  function confirm(value: Confirmation) {
    if (pending.current || resolver.current) return Promise.resolve(false);
    setConfirmation(value);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }
  function resolve(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setConfirmation(null);
  }
  if (!state)
    return (
      <div className={styles.loading} role="status">
        <h1>Zapret Desktop</h1>
        <p>{notice?.text ?? "Загружаем состояние приложения…"}</p>
        <button onClick={() => void refresh()}>Повторить</button>
      </div>
    );
  return (
    <Context.Provider
      value={{
        state,
        bridge,
        busy,
        act,
        task,
        refresh,
        confirm,
        notify,
        dirty: (kind, value) => {
          edits.current[kind] = value;
        },
        hasEdits: () => edits.current.settings || edits.current.lists,
      }}
    >
      <fieldset disabled={busy} className={styles.boundary} aria-busy={busy}>
        {notice?.text && (
          <div className={styles.notification}>
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        )}
        {children}
      </fieldset>
      <ConfirmDialog confirmation={confirmation} onResolve={resolve} />
    </Context.Provider>
  );
}
