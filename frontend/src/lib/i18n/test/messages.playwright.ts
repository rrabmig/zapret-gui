import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import * as backend from "@lib/bridge/messages/.i18n";

import * as shell from "@screens/AppShell/.i18n";
import * as lists from "@screens/Lists/.i18n";
import * as overview from "@screens/Overview/.i18n";
import * as settings from "@screens/Settings/.i18n";
import * as strategies from "@screens/Strategies/.i18n";
import * as updates from "@screens/Updates/.i18n";

function placeholders(text: string) {
  return [
    ...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
  ].sort();
}

test("Go message codes and named parameters have translations", () => {
  for (const set of [
    backend,
    shell,
    lists,
    overview,
    settings,
    strategies,
    updates,
  ]) {
    for (const [key, ru] of Object.entries(set.ru)) {
      const en = Object.entries(set.en).find(([name]) => name === key)?.[1];
      expect(en, key).toBeTruthy();
      expect(placeholders(en ?? ""), key).toEqual(placeholders(ru));
    }
  }
  const core = resolve("../internal/core");
  const files = [
    resolve("../app.go"),
    ...readdirSync(core)
      .filter((file) => file.endsWith(".go") && !file.endsWith("_test.go"))
      .map((file) => resolve(core, file)),
  ];
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(
      /NewMessage(?:Error)?\("([^"]+)"/g,
    )) {
      expect(Object.hasOwn(backend.ru, match[1]), `${file}: ${match[1]}`).toBe(
        true,
      );
      expect(Object.hasOwn(backend.en, match[1]), `${file}: ${match[1]}`).toBe(
        true,
      );
    }
  }
});
