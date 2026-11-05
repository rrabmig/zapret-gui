import { useState } from "react";

import { openExternalLink } from "@lib/bridge/desktop";
import { backendText } from "@lib/bridge/messages";
import { policy } from "@lib/bridge/policy";
import type { InstalledVersion } from "@lib/bridge/types";
import { renderText, useI18n, useLanguage } from "@lib/i18n";

import { Badge } from "@components/Badge/Badge";
import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";
import { Field, Switch } from "@components/Field/Field";
import { Notice } from "@components/Notice/Notice";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./i18n";

import styles from "./Updates.module.css";
export interface IUpdatesProps {}
export function Updates(_props: IUpdatesProps) {
  const i18n = useI18n(keyset);
  const { state, act, confirm, hasEdits, notify } = useApp();
  const { language } = useLanguage();
  const p = policy(state);
  const gui = state.guiUpdate;
  const canInstall = state.os === "windows" && state.arch === "amd64";
  async function installGUI() {
    if (hasEdits()) {
      notify(i18n.message("guiSaveEdits"), "warning");
      return;
    }
    if (
      await confirm({
        title: i18n.message("guiConfirmTitle"),
        body: i18n.message("guiConfirmBody"),
        label: i18n.message("guiApply"),
      })
    )
      await act("apply-gui-update");
  }
  const [selection, setSelection] = useState("");
  const selected = state.versions.some((v) => v.tag === selection)
    ? selection
    : state.versions.some((v) => v.tag === state.config.active)
      ? state.config.active
      : state.versions.find((v) => !v.problem)?.tag || "";
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const date = (value: string) => new Date(value).toLocaleDateString(locale);
  async function activate(version: InstalledVersion | undefined) {
    if (!version || version.problem) return;
    if (
      version.strategy !== state.config.strategy &&
      !(await confirm({
        title: i18n.message("Сменить стратегию?"),
        body: i18n.message(
          "В сборке Flowseal {tag} текущая стратегия недоступна. Будет выбрана {strategy}; отсутствующие fake-файлы заменятся стандартными.",
          { tag: version.tag, strategy: version.strategy },
        ),
        label: i18n.message("Применить"),
      }))
    )
      return;
    await act(
      "activate",
      version.tag,
      i18n.message("Версия выбрана. zapret не запущен."),
    );
    setSelection(version.tag);
  }
  async function remove(version: InstalledVersion) {
    if (
      await confirm({
        title: i18n.message("Удалить версию {tag}?", { tag: version.tag }),
        body: i18n.message(
          "Пакет будет удалён. Настройки и пользовательские списки сохранятся. Для повторного использования потребуется скачать пакет заново.",
        ),
        label: i18n.message("Удалить"),
      })
    )
      await act("delete-version", version.tag);
  }
  const blocked = state.engine.statusError
    ? i18n("Не удалось определить состояние zapret.")
    : state.toolSession
      ? i18n("Завершите сеанс оригинальных утилит.")
      : state.engine.serviceInstalled || state.engine.foreignServiceInstalled
        ? i18n(
            "Остановите и удалите установленную службу перед изменением версий.",
          )
        : !p.idle
          ? i18n("Остановите zapret перед изменением версий.")
          : "";
  return (
    <div className={styles.stack}>
      <Section
        title="GUI for zapret"
        description={i18n("guiDescription")}
        action={
          <Button onClick={() => void act("check-gui-update")}>
            {i18n("guiCheck")}
          </Button>
        }
      >
        <Switch
          label={i18n("guiAutoCheck")}
          checked={!!state.config.guiAutoCheck}
          onChange={(value) => {
            if (hasEdits()) notify(i18n.message("guiSaveEdits"), "warning");
            else
              void act(
                "settings",
                JSON.stringify({ ...state.config, guiAutoCheck: value }),
              );
          }}
        />
        <Card>
          <div className={styles.release}>
            <div>
              <span>{i18n("guiInstalled")}</span>
              <strong>{state.version}</strong>
            </div>
            <div>
              <span>{i18n("guiRelease")}</span>
              <strong>
                {gui?.tag ||
                  (gui?.checked ? i18n("guiNoReleases") : i18n("Не проверен"))}
              </strong>
            </div>
          </div>
          {gui?.tag && !gui.available && <p>{i18n("guiCurrent")}</p>}
          {gui?.notes && (
            <details>
              <summary>{i18n("guiNotes")}</summary>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {gui.notes}
              </p>
            </details>
          )}
        </Card>
        <div className={styles.actionLine}>
          <p>
            {i18n("guiConfirmationHint")}
            {gui?.available
              ? ` · ${(gui.size / 1024 / 1024).toFixed(1)} ${i18n("МБ")}`
              : ""}
          </p>
          <div className={styles.actions}>
            <a
              href={
                gui?.url || "https://github.com/rrabmig/zapret-gui/releases"
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={openExternalLink}
            >
              {i18n("guiReleases")}
            </a>
            {canInstall && (
              <Button
                disabled={!gui?.available || gui.ready}
                onClick={() => void act("download-gui-update")}
              >
                {gui?.ready ? i18n("guiReady") : i18n("guiDownload")}
              </Button>
            )}
            {canInstall && gui?.ready && (
              <Button
                variant="primary"
                disabled={
                  state.engine.elevated ||
                  !!state.engine.statusError ||
                  state.engine.externalRunning ||
                  state.toolSession
                }
                onClick={() => void installGUI()}
              >
                {i18n("guiApply")}
              </Button>
            )}
          </div>
        </div>
        {!canInstall && <Notice>{i18n("guiManual")}</Notice>}
        {canInstall && state.engine.elevated && (
          <Notice>{i18n("guiUnelevated")}</Notice>
        )}
      </Section>
      <Section
        title={i18n("Выбранная сборка")}
        description={i18n("Выбор версии не запускает zapret.")}
      >
        <Card>
          <div className={styles.selection}>
            <Field label={i18n("Сборка Flowseal")}>
              {(id) => (
                <select
                  id={id}
                  value={selected}
                  disabled={!p.idle || !state.versions.length}
                  onChange={(e) => setSelection(e.target.value)}
                >
                  {!state.config.active && (
                    <option value="">{i18n("Не выбрана")}</option>
                  )}
                  {state.versions.map((v) => (
                    <option key={v.tag} value={v.tag} disabled={!!v.problem}>
                      {v.tag}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Button
              variant="primary"
              disabled={
                !p.idle || !selected || selected === state.config.active
              }
              onClick={() =>
                void activate(state.versions.find((v) => v.tag === selected))
              }
            >
              {i18n("Применить")}
            </Button>
          </div>
        </Card>
        {blocked && <Notice tone="warning">{blocked}</Notice>}
      </Section>
      <Section
        title={i18n("Пакет zapret от Flowseal")}
        description="Flowseal / zapret-discord-youtube"
        action={
          <Button onClick={() => void act("check-updates")}>
            {i18n("Проверить обновления")}
          </Button>
        }
      >
        <Card>
          <div className={styles.release}>
            <div>
              <span>{i18n("Выбрана")}</span>
              <strong>{state.config.active || i18n("Не выбрана")}</strong>
            </div>
            <div>
              <span>{i18n("Релиз Flowseal")}</span>
              <strong>{state.latest?.tag_name || i18n("Не проверен")}</strong>
            </div>
            <div>
              <span>{i18n("Последняя проверка")}</span>
              <p>
                {state.lastCheck
                  ? date(state.lastCheck)
                  : i18n("Ещё не выполнялась")}
              </p>
            </div>
          </div>
        </Card>
        <div className={styles.actionLine}>
          <p>
            {i18n(
              "ZIP из релизов Flowseal с проверкой SHA-256. Скачивание не меняет выбранную сборку.",
            )}
          </p>
          <Button
            disabled={
              !p.idle ||
              (!!state.latest &&
                state.versions.some((v) => v.tag === state.latest?.tag_name))
            }
            onClick={() =>
              void act(
                "download-version",
                "",
                i18n.message("Версия скачана. Выберите её для использования."),
              )
            }
          >
            {i18n("Скачать сборку Flowseal")}
          </Button>
        </div>
      </Section>
      <Section
        title={i18n("Скачанные сборки")}
        action={
          <Button
            disabled={!p.idle || !state.config.previous}
            onClick={() =>
              void activate(
                state.versions.find((v) => v.tag === state.config.previous),
              )
            }
          >
            {i18n("Вернуться к предыдущей")}
          </Button>
        }
      >
        <Card>
          {state.versions.map((v) => (
            <div key={v.tag} className={styles.row}>
              <div>
                <code>{v.tag}</code>
                <p>
                  {date(v.downloadedAt)} ·{" "}
                  {new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 1,
                  }).format(v.size / 1024 / 1024)}{" "}
                  {i18n("МБ")}
                </p>
                {v.problem && (
                  <p>{renderText(backendText(v.problem), language)}</p>
                )}
              </div>
              <div className={styles.actions}>
                {state.config.active === v.tag ? (
                  <Badge tone="success">{i18n("Выбрана")}</Badge>
                ) : (
                  <>
                    {state.config.previous === v.tag && (
                      <Badge>{i18n("Предыдущая")}</Badge>
                    )}
                    <Button
                      variant="danger"
                      disabled={!p.idle}
                      aria-label={i18n("Удалить версию {tag}", { tag: v.tag })}
                      onClick={() => void remove(v)}
                    >
                      {i18n("Удалить")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!state.versions.length && (
            <div className={styles.empty}>{i18n("Сборки ещё не скачаны.")}</div>
          )}
        </Card>
        <div className={styles.folder}>
          <code>{state.versionsDir}</code>
          <Button onClick={() => void act("open-versions")}>
            {i18n("Открыть папку")}
          </Button>
        </div>
      </Section>
    </div>
  );
}
