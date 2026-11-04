import { useEffect, useState } from "react";

import { useBackendI18n } from "@lib/bridge/messages";
import { policy } from "@lib/bridge/policy";
import type { Config } from "@lib/bridge/types";
import { useI18n, useLanguage } from "@lib/i18n";

import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";
import { Field, Switch } from "@components/Field/Field";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./.i18n";

import styles from "../../design/Page.module.css";
export interface ISettingsProps {}
export function Settings(_props: ISettingsProps) {
  const i18n = useI18n(keyset);
  const backend = useBackendI18n();
  const { state, act, confirm, dirty, hasEdits, notify, changeLanguage } =
    useApp();
  const { language } = useLanguage();
  const p = policy(state);
  const [draft, setDraft] = useState(state.config);
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!edited) setDraft(state.config);
  }, [state.config, edited]);
  function change<K extends keyof Config>(key: K, value: Config[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setEdited(true);
    dirty("settings", true);
  }
  async function save() {
    if (!draft.gameTCP.trim() || !draft.gameUDP.trim()) {
      notify(backend.message("error020"), "danger");
      const name = !draft.gameTCP.trim() ? "gameTCP" : "gameUDP";
      document
        .querySelector<HTMLInputElement>(`input[name="${name}"]`)
        ?.focus();
      return;
    }
    if (
      draft.ipset === "any" &&
      state.config.ipset !== "any" &&
      !(await confirm({
        title: i18n.message("Фильтровать все IP?"),
        body: i18n.message(
          "Режим any может затронуть сайты, игры и приложения, которые работают без zapret.",
        ),
        label: i18n.message("Выбрать any"),
      }))
    )
      return;
    // Package pointers and strategy can change independently while this form is open.
    const next = {
      ...draft,
      language,
      active: state.config.active,
      previous: state.config.previous,
      strategy: state.config.strategy,
      gameTCP: draft.gameTCP.trim(),
      gameUDP: draft.gameUDP.trim(),
    };
    if (
      await act(
        "settings",
        JSON.stringify(next),
        i18n.message("Настройки сохранены. Движок не запущен автоматически."),
      )
    ) {
      setEdited(false);
      dirty("settings", false);
    }
  }
  function select<
    K extends "theme" | "gameMode" | "ipset" | "discordFake" | "gameFake",
  >(
    key: K,
    label: string,
    hint: string,
    options: [Config[K], string][],
    disabled = false,
  ) {
    return (
      <Field label={label} hint={hint}>
        {(id, hintId) => (
          <select
            id={id}
            aria-describedby={hintId}
            value={draft[key]}
            disabled={disabled}
            onChange={(e) => {
              const option = options.find(
                ([value]) => value === e.target.value,
              );
              if (option) change(key, option[0]);
            }}
          >
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  }
  const fakeOptions: [string, string][] = [
    ["", i18n("Как в upstream")],
    ...state.fakes.map((name): [string, string] => [name, name]),
  ];
  return (
    <div className={styles.stack}>
      <form
        noValidate
        className={styles.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section
          title={i18n("Поведение приложения")}
          description={i18n("Изменения применяются после сохранения.")}
        >
          <Card>
            <Field label={i18n("language")} hint={i18n("languageHint")}>
              {(id, hintId) => (
                <select
                  id={id}
                  aria-describedby={hintId}
                  value={language}
                  onChange={(event) =>
                    changeLanguage(event.target.value === "en" ? "en" : "ru")
                  }
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              )}
            </Field>
            <Switch
              label={i18n("Разрешить запуск движка")}
              hint={i18n("Запуск, службы и системные действия на Windows.")}
              checked={draft.engineAllowed}
              disabled={!state.engine.supported}
              onChange={(value) => change("engineAllowed", value)}
            />
            <Switch
              label={i18n("Проверять обновления при открытии")}
              hint={i18n(
                "Только метаданные GitHub. Установка остаётся ручной.",
              )}
              checked={draft.autoCheck}
              onChange={(value) => change("autoCheck", value)}
            />
            {select(
              "theme",
              i18n("Оформление"),
              i18n("Светлая, тёмная или тема системы."),
              [
                ["system", i18n("Системная")],
                ["light", i18n("Светлая")],
                ["dark", i18n("Тёмная")],
              ],
            )}
          </Card>
        </Section>
        <Section
          title={i18n("Фильтрация")}
          description={i18n(
            "Остановите движок и удалите службу перед изменением фильтров.",
          )}
        >
          <Card>
            {select(
              "gameMode",
              "Game Filter",
              i18n("Режим фильтрации игровых портов."),
              [
                ["disabled", i18n("Выключен")],
                ["all", i18n("TCP и UDP")],
                ["tcp", i18n("Только TCP")],
                ["udp", i18n("Только UDP")],
              ],
              !p.idle,
            )}
            {(["gameTCP", "gameUDP"] as const).map((key) => (
              <Field
                key={key}
                label={i18n("ports", {
                  protocol: key === "gameTCP" ? "TCP" : "UDP",
                })}
                hint={i18n("Диапазоны и отдельные порты через запятую.")}
              >
                {(id, hintId) => (
                  <input
                    id={id}
                    name={key}
                    aria-describedby={hintId}
                    value={draft[key]}
                    disabled={!p.idle}
                    maxLength={512}
                    required
                    onChange={(e) => change(key, e.target.value)}
                  />
                )}
              </Field>
            ))}
            {select(
              "ipset",
              "IPSet Filter",
              draft.ipset === "any"
                ? i18n("Все IP: может нарушать доступ к другим ресурсам.")
                : draft.ipset === "none"
                  ? i18n("Без фильтрации по списку IP.")
                  : i18n("Только IP из загруженного списка."),
              [
                ["loaded", i18n("loaded · по списку")],
                ["none", i18n("none · без IP")],
                ["any", i18n("any · все IP")],
              ],
              !p.idle,
            )}
          </Card>
        </Section>
        <Section
          title={i18n("Активные фейки")}
          description={i18n(
            "Файлы из bin текущего релиза. Применяются в рабочей копии.",
          )}
        >
          <Card>
            {select(
              "discordFake",
              "Discord UDP",
              "ACTIVE_DISCORD_UDP.bin",
              fakeOptions,
              !p.idle,
            )}
            {select(
              "gameFake",
              "Game UDP",
              "ACTIVE_GAME_UDP.bin",
              fakeOptions,
              !p.idle,
            )}
          </Card>
        </Section>
        <div className={styles.actionLine}>
          <p>
            {edited
              ? i18n("Есть несохранённые изменения.")
              : i18n("Все изменения сохранены.")}
          </p>
          <div className={styles.actions}>
            {edited && (
              <Button
                onClick={() => {
                  setDraft(state.config);
                  setEdited(false);
                  dirty("settings", false);
                }}
              >
                {i18n("Отменить изменения")}
              </Button>
            )}
            <Button type="submit" variant="primary">
              {i18n("Сохранить настройки")}
            </Button>
          </div>
        </div>
      </form>
      <Section
        title={i18n("Права администратора")}
        description={i18n("Нужны для WinDivert, службы и системного hosts.")}
        action={
          <Button
            disabled={
              !p.allowed ||
              state.engine.elevated ||
              state.engine.running ||
              state.toolSession
            }
            onClick={() => {
              if (hasEdits())
                notify(
                  i18n.message(
                    "Сохраните изменения перед перезапуском с правами администратора.",
                  ),
                  "warning",
                );
              else void act("elevate");
            }}
          >
            {i18n("Запросить права")}
          </Button>
        }
      >
        <p className={styles.footnote}>{state.dataDir}</p>
      </Section>
    </div>
  );
}
