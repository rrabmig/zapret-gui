import { type Message, type Text, useI18n } from "@lib/i18n";

import * as keyset from "./.i18n";

/** Validate the Wails JSON rejection envelope; unknown external text stays verbatim. */
function decode(value: unknown): Message | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("code" in value) ||
    typeof value.code !== "string"
  )
    return;
  const ru = Object.entries(keyset.ru).find(([key]) => key === value.code)?.[1];
  const en = Object.entries(keyset.en).find(([key]) => key === value.code)?.[1];
  if (
    !ru ||
    !en ||
    !("params" in value) ||
    !value.params ||
    typeof value.params !== "object"
  )
    return;
  const params: Record<string, string | number> = {};
  for (const [key, item] of Object.entries(value.params)) {
    if (typeof item !== "string" && typeof item !== "number") return;
    params[key] = item;
  }
  return { key: value.code, text: { ru, en }, params };
}
export function backendText(text: string): Text {
  try {
    const value: unknown = JSON.parse(text);
    return decode(value) ?? text;
  } catch {
    return text;
  }
}
export function bridgeError(error: unknown): Message {
  const detail = error instanceof Error ? error.message : String(error);
  const decoded = backendText(detail);
  return typeof decoded !== "string"
    ? decoded
    : {
        key: "operationFailed",
        text: { ru: keyset.ru.operationFailed, en: keyset.en.operationFailed },
        params: { detail },
      };
}
export function useBackendI18n() {
  return useI18n(keyset);
}
