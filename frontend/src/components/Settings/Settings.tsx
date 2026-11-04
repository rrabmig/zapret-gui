import { useEffect, useState } from "react";
import { useApp } from "../../app/AppProvider";
import { policy } from "../../bridge/policy";
import type { Config } from "../../bridge/types";
import { Button } from "../Button/Button";
import { Card, Section } from "../Card/Card";
import { Field, Switch } from "../Field/Field";
import styles from "../../design/Page.module.css";
export function Settings() {
  const { state, act, confirm, dirty, hasEdits, notify } = useApp();
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
    if (
      draft.ipset === "any" &&
      state.config.ipset !== "any" &&
      !(await confirm({
        title: "Фильтровать все IP?",
        body: "Режим any может затронуть сайты, игры и приложения, которые работают без zapret.",
        label: "Выбрать any",
      }))
    )
      return;
    // Package pointers and strategy can change independently while this form is open.
    const next = {
      ...draft,
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
        "Настройки сохранены. Движок не запущен автоматически.",
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
            onChange={(e) => change(key, e.target.value as Config[K])}
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
    ["", "Как в upstream"],
    ...state.fakes.map((name) => [name, name] as [string, string]),
  ];
  return (
    <div className={styles.stack}>
      <form
        className={styles.stack}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Section
          title="Поведение приложения"
          description="Изменения применяются после сохранения."
        >
          <Card>
            <Switch
              label="Разрешить запуск движка"
              hint="Запуск, службы и системные действия на Windows."
              checked={draft.engineAllowed}
              disabled={!state.engine.supported}
              onChange={(value) => change("engineAllowed", value)}
            />
            <Switch
              label="Проверять обновления при открытии"
              hint="Только метаданные GitHub. Установка остаётся ручной."
              checked={draft.autoCheck}
              onChange={(value) => change("autoCheck", value)}
            />
            {select(
              "theme",
              "Оформление",
              "Светлая, тёмная или тема системы.",
              [
                ["system", "Системная"],
                ["light", "Светлая"],
                ["dark", "Тёмная"],
              ],
            )}
          </Card>
        </Section>
        <Section
          title="Фильтрация"
          description="Остановите движок и удалите службу перед изменением фильтров."
        >
          <Card>
            {select(
              "gameMode",
              "Game Filter",
              "Режим фильтрации игровых портов.",
              [
                ["disabled", "Выключен"],
                ["all", "TCP и UDP"],
                ["tcp", "Только TCP"],
                ["udp", "Только UDP"],
              ],
              !p.idle,
            )}
            {(["gameTCP", "gameUDP"] as const).map((key) => (
              <Field
                key={key}
                label={`Порты ${key === "gameTCP" ? "TCP" : "UDP"}`}
                hint="Диапазоны и отдельные порты через запятую."
              >
                {(id, hintId) => (
                  <input
                    id={id}
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
                ? "Все IP: может нарушать доступ к другим ресурсам."
                : draft.ipset === "none"
                  ? "Без фильтрации по списку IP."
                  : "Только IP из загруженного списка.",
              [
                ["loaded", "loaded · по списку"],
                ["none", "none · без IP"],
                ["any", "any · все IP"],
              ],
              !p.idle,
            )}
          </Card>
        </Section>
        <Section
          title="Активные фейки"
          description="Файлы из bin текущего релиза. Применяются в рабочей копии."
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
              ? "Есть несохранённые изменения."
              : "Все изменения сохранены."}
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
                Отменить изменения
              </Button>
            )}
            <Button type="submit" variant="primary">
              Сохранить настройки
            </Button>
          </div>
        </div>
      </form>
      <Section
        title="Права администратора"
        description="Нужны для WinDivert, службы и системного hosts."
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
                  "Сохраните изменения перед перезапуском с правами администратора.",
                  "warning",
                );
              else void act("elevate");
            }}
          >
            Запросить права
          </Button>
        }
      >
        <p className={styles.footnote}>{state.dataDir}</p>
      </Section>
    </div>
  );
}
