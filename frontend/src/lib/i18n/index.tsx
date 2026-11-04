import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type Language = "ru" | "en";
export type I18nSet<Key extends PropertyKey> = {
  [L in Language]: { [K in Key]: string };
};
export type Parameters = Readonly<Record<string, string | number>>;
/** Deferred code + data. Notices and dialogs translate at render time. */
export interface Message {
  key: string;
  text: { ru: string; en: string };
  params: Parameters;
}
export type Text = string | Message;
export function normalizeLanguage(value: unknown): Language {
  return value === "en" ? "en" : "ru";
}
export function renderText(value: Text, language: Language): string {
  if (typeof value === "string") return value;
  return value.text[language].replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(value.params, name) ? String(value.params[name]) : match,
  );
}
const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  isControlled: boolean;
} | null>(null);
export interface II18nProviderProps {
  children: ReactNode;
  language?: Language;
  onLanguageChange?: (language: Language) => void;
}
export function I18nProvider({
  children,
  language: controlled,
  onLanguageChange,
}: II18nProviderProps) {
  const [local, setLocal] = useState<Language>("ru");
  const onChange = useRef(onLanguageChange);
  onChange.current = onLanguageChange;
  const setLanguage = useCallback((next: Language) => {
    setLocal(next);
    onChange.current?.(next);
  }, []);
  const language = controlled ?? local;
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <Context.Provider
      value={{ language, setLanguage, isControlled: controlled !== undefined }}
    >
      {children}
    </Context.Provider>
  );
}
const fallback: {
  language: Language;
  setLanguage: (language: Language) => void;
  isControlled: boolean;
} = {
  language: "ru",
  setLanguage: () => {},
  isControlled: false,
};
export function useLanguage() {
  return useContext(Context) ?? fallback;
}
export interface II18nRootProps {
  children: ReactNode;
}
export function I18nRoot({ children }: II18nRootProps) {
  const parent = useContext(Context);
  return parent ? children : <I18nProvider>{children}</I18nProvider>;
}
/** Inference captures both dictionaries independently; en must have exactly ru's keys. */
export function useI18n<R extends object, E extends object>(
  keyset: { ru: R; en: E } & I18nSet<keyof R> & {
      en: { [K in Exclude<keyof E, keyof R>]: never };
    },
) {
  const { language } = useLanguage();
  function message(key: keyof R & string, params: Parameters = {}): Message {
    return { key, text: { ru: keyset.ru[key], en: keyset.en[key] }, params };
  }
  function i18n(key: keyof R & string, params: Parameters = {}) {
    return renderText(message(key, params), language);
  }
  i18n.message = message;
  return i18n;
}
