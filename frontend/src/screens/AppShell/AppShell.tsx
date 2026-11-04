import {
  DashboardIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GearIcon,
  MixerHorizontalIcon,
  ReaderIcon,
} from "@radix-ui/react-icons";
import { useState } from "react";

import { openBuilds } from "@lib/bridge/desktop";
import { useI18n } from "@lib/i18n";
import { arrowNavigation } from "@lib/keyboard/arrowNavigation";

import { Button } from "@components/Button/Button";
import { Notice } from "@components/Notice/Notice";

import { Journal } from "@screens/Journal/Journal";
import { Lists } from "@screens/Lists/Lists";
import { Overview } from "@screens/Overview/Overview";
import { Settings } from "@screens/Settings/Settings";
import { Strategies } from "@screens/Strategies/Strategies";
import { Updates } from "@screens/Updates/Updates";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./.i18n";

import styles from "./AppShell.module.css";

export interface IAppShellProps {}
export function AppShell(_props: IAppShellProps) {
  const i18n = useI18n(keyset);
  const tabs = [
    ["overview", i18n("Обзор"), DashboardIcon, i18n("Управляйте подключением")],
    [
      "strategies",
      i18n("Стратегии"),
      MixerHorizontalIcon,
      i18n("Выберите подходящую стратегию"),
    ],
    [
      "lists",
      i18n("Списки"),
      FileTextIcon,
      i18n("Настройте, к чему применять фильтрацию"),
    ],
    [
      "updates",
      i18n("Обновления"),
      DownloadIcon,
      i18n("Официальные пакеты Flowseal"),
    ],
    [
      "settings",
      i18n("Настройки"),
      GearIcon,
      i18n("Поведение приложения и фильтрация"),
    ],
    ["journal", i18n("Журнал"), ReaderIcon, i18n("События и диагностика")],
  ] as const;
  const [tab, setTab] = useState<string>("overview");
  const { state, act } = useApp();
  const current = tabs.find((item) => item[0] === tab)!;
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#workspace">
        {i18n("Перейти к содержимому")}
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          zapret<span>desktop</span>
        </div>
        <p className={styles.tagline}>
          {i18n("Оригинальный движок.")}
          <br />
          {i18n("Всё под контролем.")}
        </p>
        <nav
          aria-label={i18n("Разделы")}
          className={styles.nav}
          onKeyDown={(event) => arrowNavigation(event, true)}
        >
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-current={id === tab ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon width={16} height={16} />
              <span>{label}</span>
              {id === "strategies" && <small>{state.strategies.length}</small>}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <span>{i18n("Независимый GUI для Flowseal")}</span>
          <Button variant="quiet" onClick={openBuilds}>
            {i18n("Скачать приложение")}
            <ExternalLinkIcon />
          </Button>
          <code>{state.version}</code>
        </div>
      </aside>
      <main
        id="workspace"
        tabIndex={-1}
        aria-labelledby="workspace-title"
        className={styles.main}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{i18n("Рабочее пространство")}</p>
            <h1 id="workspace-title">{current[1]}</h1>
            <p>{current[3]}</p>
          </div>
          <span className={styles.platform}>
            {state.os} / {state.arch}
          </span>
        </header>
        <div className={styles.content}>
          {!state.engine.supported && (
            <Notice tone="warning">
              {i18n(
                "На этой ОС доступны пакеты, списки и настройки. Запуск движка Flowseal, службы и сетевые тесты требуют Windows и WinDivert.",
              )}
            </Notice>
          )}
          {state.toolSession && (
            <Notice tone="warning">
              {i18n(
                "Открыто оригинальное окно upstream. Закройте его после завершения работы.",
              )}{" "}
              <Button
                variant="quiet"
                onClick={() => void act("tools-finished")}
              >
                {i18n("Сеанс завершён")}
              </Button>
            </Notice>
          )}
          <div hidden={tab !== "overview"}>
            <Overview />
          </div>
          <div hidden={tab !== "strategies"}>
            <Strategies />
          </div>
          <div hidden={tab !== "lists"}>
            <Lists active={tab === "lists"} />
          </div>
          <div hidden={tab !== "updates"}>
            <Updates />
          </div>
          <div hidden={tab !== "settings"}>
            <Settings />
          </div>
          <div hidden={tab !== "journal"}>
            <Journal />
          </div>
        </div>
        <footer className={styles.footer}>
          <span>{i18n("Без автоматического запуска")}</span>
          <span>{i18n("Официальные релизы · ваши настройки")}</span>
        </footer>
      </main>
    </div>
  );
}
