import {
  MagnifyingGlassIcon,
  PlayIcon,
  ReaderIcon,
  ResetIcon,
} from "@radix-ui/react-icons";

import { backendText, useBackendI18n } from "@lib/bridge/messages";
import { policy } from "@lib/bridge/policy";
import type { Action } from "@lib/bridge/types";
import type { Text } from "@lib/i18n";
import { renderText, useLanguage } from "@lib/i18n";
import { useI18n } from "@lib/i18n";

import { Badge } from "@components/Badge/Badge";
import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";
import { ConnectionCard } from "@components/ConnectionCard/ConnectionCard";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./i18n";

import styles from "../../design/Page.module.css";
export interface IOverviewProps {}
export function Overview(_props: IOverviewProps) {
  const i18n = useI18n(keyset);
  const { state, act, confirm } = useApp();
  const p = policy(state);
  const e = state.engine;
  const backend = useBackendI18n();
  const { language } = useLanguage();
  async function guarded(action: Action, title: Text, body: Text, label: Text) {
    if (await confirm({ title, body, label })) await act(action);
  }
  return (
    <div className={styles.stack}>
      <ConnectionCard
        state={state}
        onToggle={() =>
          void act(
            e.running ? "stop" : e.serviceRunning ? "service-stop" : "start",
          )
        }
      />
      <Section
        title={i18n("Автозапуск zapret")}
        description={i18n("zapret продолжает работать после закрытия GUI.")}
        action={
          <Badge tone={e.serviceRunning ? "success" : "neutral"}>
            {e.serviceRunning
              ? i18n("Работает")
              : e.serviceInstalled
                ? i18n("Установлена")
                : i18n("Не установлена")}
          </Badge>
        }
      >
        <Card>
          <div className={styles.row}>
            <div>
              <h3>{i18n("Запуск вместе с Windows")}</h3>
              <p>{i18n("Служба zapret под управлением GUI for zapret")}</p>
            </div>
            <div className={styles.actions}>
              <Button
                disabled={!p.allowed || !p.packaged || !p.idle}
                onClick={() =>
                  void guarded(
                    "service-install",
                    i18n.message("Включить автозапуск?"),
                    i18n.message(
                      "GUI создаст и запустит службу для zapret. zapret продолжит работать после закрытия GUI.",
                    ),
                    i18n.message("Установить службу"),
                  )
                }
              >
                {i18n("Установить")}
              </Button>
              <Button
                disabled={
                  !p.allowed ||
                  !e.serviceInstalled ||
                  e.serviceRunning ||
                  e.running ||
                  e.externalRunning ||
                  e.foreignServiceInstalled ||
                  state.toolSession
                }
                aria-label={i18n("Запустить службу")}
                onClick={() => void act("service-start")}
              >
                {i18n("Запустить")}
              </Button>
              <Button
                disabled={!p.allowed || !e.serviceRunning || state.toolSession}
                aria-label={i18n("Остановить службу")}
                onClick={() => void act("service-stop")}
              >
                {i18n("Остановить")}
              </Button>
              <Button
                variant="danger"
                disabled={
                  !p.allowed || !e.serviceInstalled || state.toolSession
                }
                onClick={() =>
                  void guarded(
                    "service-remove",
                    i18n.message("Удалить службу?"),
                    i18n.message(
                      "Служба zapret, созданная этим GUI, будет остановлена и удалена. Другие службы сохранятся.",
                    ),
                    i18n.message("Удалить"),
                  )
                }
              >
                {i18n("Удалить")}
              </Button>
            </div>
          </div>
        </Card>
      </Section>
      <Section
        title={i18n("Инструменты")}
        description={i18n("Диагностика и оригинальные утилиты Flowseal.")}
      >
        <div className={styles.toolGrid}>
          <button
            className={styles.tool}
            onClick={() => void act("diagnostics")}
          >
            <MagnifyingGlassIcon />
            <span>
              <strong>{i18n("Диагностика")}</strong>
              <small>{i18n("Чтение локального состояния")}</small>
            </span>
          </button>
          <button
            className={styles.tool}
            disabled={!p.allowed || !p.packaged || !p.idle}
            onClick={() =>
              void guarded(
                "tests",
                i18n.message("Запустить сетевые проверки?"),
                i18n.message(
                  "Оригинальная утилита Flowseal запускает стратегии и обращается к внешним ресурсам: Standard tests и DPI checkers. Используйте на личном устройстве в подходящей сети.",
                ),
                i18n.message("Открыть утилиту"),
              )
            }
          >
            <PlayIcon />
            <span>
              <strong>{i18n("Проверка стратегий")}</strong>
              <small>{i18n("Standard tests и DPI checkers")}</small>
            </span>
          </button>
          <button
            className={styles.tool}
            disabled={!p.allowed || !p.packaged || !p.idle}
            onClick={() =>
              void guarded(
                "menu",
                i18n.message("Открыть оригинальное меню?"),
                i18n.message(
                  "service.bat работает с правами администратора и может менять сеть, службы и файлы. Изменения в нём не переносятся в сохранённые настройки GUI.",
                ),
                i18n.message("Открыть service.bat"),
              )
            }
          >
            <ReaderIcon />
            <span>
              <strong>{i18n("Оригинальное меню")}</strong>
              <small>{i18n("Утилита service.bat из сборки Flowseal")}</small>
            </span>
          </button>
          <button
            className={styles.tool}
            disabled={!p.allowed}
            onClick={() =>
              void guarded(
                "clear-discord-cache",
                i18n.message("Сбросить кэш Discord?"),
                i18n.message(
                  "Сначала закройте Discord. Cache, Code Cache и GPUCache будут переименованы в резервные папки для Stable, PTB, Canary и Development.",
                ),
                i18n.message("Сохранить резервные копии"),
              )
            }
          >
            <ResetIcon />
            <span>
              <strong>{i18n("Кэш Discord")}</strong>
              <small>{i18n("С резервной копией папок")}</small>
            </span>
          </button>
        </div>
        {(state.checks ?? []).map((check) => (
          <details
            className={styles.details}
            key={renderText(backendText(check.name), language)}
          >
            <summary>
              <Badge
                tone={
                  check.state === "ok"
                    ? "success"
                    : check.state === "error"
                      ? "danger"
                      : "warning"
                }
              >
                {backend(
                  check.state === "ok" ||
                    check.state === "error" ||
                    check.state === "warning" ||
                    check.state === "unavailable"
                    ? check.state
                    : "info",
                )}
              </Badge>{" "}
              {renderText(backendText(check.name), language)}
            </summary>
            <pre>{renderText(backendText(check.detail), language)}</pre>
          </details>
        ))}
      </Section>
      <p className={styles.footnote}>
        {i18n(
          "Закрытие GUI останавливает только процесс, запущенный этим приложением.",
        )}
      </p>
    </div>
  );
}
