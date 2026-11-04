import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { bridgeError } from "@lib/bridge/messages";
import type { Action, Bridge, Snapshot } from "@lib/bridge/types";
import {
  type Language,
  normalizeLanguage,
  renderText,
  type Text,
  useLanguage,
} from "@lib/i18n";
import { useI18n } from "@lib/i18n";

import type { Tone } from "@components/Badge/Badge";
import {
  type Confirmation,
  ConfirmDialog,
} from "@components/ConfirmDialog/ConfirmDialog";
import { Notice } from "@components/Notice/Notice";

import * as keyset from "./.i18n";

import styles from "../App.module.css";
interface Model {
  state: Snapshot;
  bridge: Bridge;
  busy: boolean;
  changeLanguage(language: Language): void;
  act(action: Action, payload?: string, success?: Text): Promise<boolean>;
  task<T>(work: () => Promise<T>, success?: Text): Promise<T | undefined>;
  refresh(): Promise<void>;
  confirm(confirmation: Confirmation): Promise<boolean>;
  dirty: (kind: "settings" | "lists", value: boolean) => void;
  hasEdits(): boolean;
  notify(text: Text, tone?: Tone): void;
}
const Context = createContext<Model | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider is required");
  return value;
}
export interface IAppProviderProps {
  bridge: Bridge;
  children: ReactNode;
}
export function AppProvider({ bridge, children }: IAppProviderProps) {
  const i18n = useI18n(keyset);
  const { language, setLanguage } = useLanguage();
  const initializedLanguage = useRef(false);
  const languageWrites = useRef(Promise.resolve());
  const [state, setState] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: Text; tone: Tone }>();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const pending = useRef(false);
  const reading = useRef<Promise<void> | null>(null);
  const active = useRef(true);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const confirmationTrigger = useRef<HTMLElement | null>(null);
  const edits = useRef({ settings: false, lists: false });
  const notify = useCallback(
    (text: Text, tone: Tone = "neutral") => setNotice({ text, tone }),
    [],
  );
  const refresh = useCallback(async () => {
    if (pending.current || reading.current || resolver.current) return;
    const read = (async () => {
      try {
        const next = await bridge.Snapshot();
        if (active.current) {
          if (!initializedLanguage.current) {
            initializedLanguage.current = true;
            setLanguage(normalizeLanguage(next.config.language));
          }
          setState(next);
        }
      } catch (error) {
        if (active.current) notify(bridgeError(error), "danger");
      }
    })();
    reading.current = read;
    try {
      await read;
    } finally {
      reading.current = null;
    }
  }, [bridge, notify, setLanguage]);

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
    success: Text = "",
  ): Promise<T | undefined> {
    if (pending.current || resolver.current) return undefined;
    const previousFocus = document.querySelector("dialog[open]")
      ? confirmationTrigger.current
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    pending.current = true;
    setBusy(true);
    notify(i18n.message("Выполняется…"));
    try {
      // A click waits for an in-flight read rather than disappearing during polling.
      await reading.current;
      const result = await work();
      if (active.current) notify(success, "success");
      return result;
    } catch (error) {
      if (active.current) notify(bridgeError(error), "danger");
      try {
        const next = await bridge.Snapshot();
        if (active.current) setState(next);
      } catch {
        /* Keep last known state. */
      }
      return undefined;
    } finally {
      pending.current = false;
      if (active.current) {
        setBusy(false);
        requestAnimationFrame(() => {
          if (
            previousFocus?.isConnected &&
            previousFocus.getClientRects().length &&
            document.activeElement === document.body
          )
            previousFocus.focus();
        });
      }
    }
  }
  async function act(
    action: Action,
    payload = "",
    success: Text = i18n.message("Готово."),
  ) {
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
    confirmationTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
        <p>
          {notice
            ? renderText(notice.text, language)
            : i18n("Загружаем состояние приложения…")}
        </p>
        <button onClick={() => void refresh()}>{i18n("Повторить")}</button>
      </div>
    );
  return (
    <Context.Provider
      value={{
        state,
        bridge,
        busy,
        changeLanguage: (next) => {
          setLanguage(next);
          languageWrites.current = languageWrites.current.then(async () => {
            try {
              await bridge.Action("language", next);
            } catch (error) {
              notify(bridgeError(error), "danger");
            }
          });
        },
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
            <Notice tone={notice.tone}>
              {renderText(notice.text, language)}
            </Notice>
          </div>
        )}
        {children}
      </fieldset>
      <ConfirmDialog confirmation={confirmation} onResolve={resolve} />
    </Context.Provider>
  );
}
