import { useState } from "react";
import { arrowNavigation } from "../../lib/keyboard/arrowNavigation";
import {
  DashboardIcon,
  MixerHorizontalIcon,
  FileTextIcon,
  DownloadIcon,
  GearIcon,
  ReaderIcon,
  ExternalLinkIcon,
} from "@radix-ui/react-icons";
import { openBuilds } from "../../lib/bridge/desktop";
import { useApp } from "../../app/AppProvider";
import { Button } from "../../components/Button/Button";
import { Notice } from "../../components/Notice/Notice";
import { Overview } from "../Overview/Overview";
import { Strategies } from "../Strategies/Strategies";
import { Lists } from "../Lists/Lists";
import { Updates } from "../Updates/Updates";
import { Settings } from "../Settings/Settings";
import { Journal } from "../Journal/Journal";
import styles from "./AppShell.module.css";
const tabs = [
  ["overview", "Обзор", DashboardIcon, "Управляйте подключением"],
  [
    "strategies",
    "Стратегии",
    MixerHorizontalIcon,
    "Выберите подходящую стратегию",
  ],
  ["lists", "Списки", FileTextIcon, "Настройте, к чему применять фильтрацию"],
  ["updates", "Обновления", DownloadIcon, "Официальные пакеты Flowseal"],
  ["settings", "Настройки", GearIcon, "Поведение приложения и фильтрация"],
  ["journal", "Журнал", ReaderIcon, "События и диагностика"],
] as const;
export interface IAppShellProps {}
export function AppShell(_props: IAppShellProps) {
  const [tab, setTab] = useState<string>("overview");
  const { state, act } = useApp();
  const current = tabs.find((item) => item[0] === tab)!;
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#workspace">
        Перейти к содержимому
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          zapret<span>desktop</span>
        </div>
        <p className={styles.tagline}>
          Оригинальный движок.
          <br />
          Всё под контролем.
        </p>
        <nav
          aria-label="Разделы"
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
          <span>Независимый GUI для Flowseal</span>
          <Button variant="quiet" onClick={openBuilds}>
            Скачать приложение <ExternalLinkIcon />
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
            <p className={styles.eyebrow}>Рабочее пространство</p>
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
              На этой ОС доступны пакеты, списки и настройки. Запуск движка
              Flowseal, службы и сетевые тесты требуют Windows и WinDivert.
            </Notice>
          )}
          {state.toolSession && (
            <Notice tone="warning">
              Открыто оригинальное окно upstream. Закройте его после завершения
              работы.{" "}
              <Button
                variant="quiet"
                onClick={() => void act("tools-finished")}
              >
                Сеанс завершён
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
          <span>Без автоматического запуска</span>
          <span>Официальные релизы · ваши настройки</span>
        </footer>
      </main>
    </div>
  );
}
