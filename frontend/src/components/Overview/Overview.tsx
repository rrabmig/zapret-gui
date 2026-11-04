import {
  MagnifyingGlassIcon,
  PlayIcon,
  ReaderIcon,
  ResetIcon,
} from "@radix-ui/react-icons";
import { useApp } from "../../app/AppProvider";
import { policy } from "../../bridge/policy";
import type { Action } from "../../bridge/types";
import { ConnectionCard } from "../ConnectionCard/ConnectionCard";
import { Button } from "../Button/Button";
import { Badge } from "../Badge/Badge";
import { Card, Section } from "../Card/Card";
import styles from "../../design/Page.module.css";
export function Overview() {
  const { state, act, confirm } = useApp();
  const p = policy(state);
  const e = state.engine;
  async function guarded(
    action: Action,
    title: string,
    body: string,
    label: string,
  ) {
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
        title="Служба и автозапуск"
        description="Продолжает работать после закрытия приложения."
        action={
          <Badge tone={e.serviceRunning ? "success" : "neutral"}>
            {e.serviceRunning
              ? "Работает"
              : e.serviceInstalled
                ? "Установлена"
                : "Не установлена"}
          </Badge>
        }
      >
        <Card>
          <div className={styles.row}>
            <div>
              <h3>Запуск вместе с Windows</h3>
              <p>Служба ZapretDesktop · текущая стратегия и настройки</p>
            </div>
            <div className={styles.actions}>
              <Button
                disabled={!p.allowed || !p.packaged || !p.idle}
                onClick={() =>
                  void guarded(
                    "service-install",
                    "Включить автозапуск?",
                    "Будет создана и запущена служба ZapretDesktop. Она продолжит работать после закрытия GUI.",
                    "Установить службу",
                  )
                }
              >
                Установить
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
                aria-label="Запустить службу"
                onClick={() => void act("service-start")}
              >
                Запустить
              </Button>
              <Button
                disabled={!p.allowed || !e.serviceRunning || state.toolSession}
                aria-label="Остановить службу"
                onClick={() => void act("service-stop")}
              >
                Остановить
              </Button>
              <Button
                variant="danger"
                disabled={
                  !p.allowed || !e.serviceInstalled || state.toolSession
                }
                onClick={() =>
                  void guarded(
                    "service-remove",
                    "Удалить службу?",
                    "Служба ZapretDesktop будет остановлена и удалена. Другие службы оболочка не удаляет.",
                    "Удалить",
                  )
                }
              >
                Удалить
              </Button>
            </div>
          </div>
        </Card>
      </Section>
      <Section
        title="Инструменты"
        description="Диагностика и оригинальные утилиты Flowseal."
      >
        <div className={styles.toolGrid}>
          <button
            className={styles.tool}
            onClick={() => void act("diagnostics")}
          >
            <MagnifyingGlassIcon />
            <span>
              <strong>Диагностика</strong>
              <small>Чтение локального состояния</small>
            </span>
          </button>
          <button
            className={styles.tool}
            disabled={!p.allowed || !p.packaged || !p.idle}
            onClick={() =>
              void guarded(
                "tests",
                "Запустить сетевые проверки?",
                "Оригинальная утилита Flowseal запускает стратегии и обращается к внешним ресурсам: Standard tests и DPI checkers. Используйте на личном устройстве в подходящей сети.",
                "Открыть утилиту",
              )
            }
          >
            <PlayIcon />
            <span>
              <strong>Проверка стратегий</strong>
              <small>Standard tests и DPI checkers</small>
            </span>
          </button>
          <button
            className={styles.tool}
            disabled={!p.allowed || !p.packaged || !p.idle}
            onClick={() =>
              void guarded(
                "menu",
                "Открыть оригинальное меню?",
                "service.bat работает с правами администратора и может менять сеть, службы и файлы. Изменения в нём не переносятся в сохранённые настройки GUI.",
                "Открыть service.bat",
              )
            }
          >
            <ReaderIcon />
            <span>
              <strong>Оригинальное меню</strong>
              <small>Все возможности service.bat</small>
            </span>
          </button>
          <button
            className={styles.tool}
            disabled={!p.allowed}
            onClick={() =>
              void guarded(
                "clear-discord-cache",
                "Сбросить кэш Discord?",
                "Сначала закройте Discord. Cache, Code Cache и GPUCache будут переименованы в резервные папки для Stable, PTB, Canary и Development.",
                "Сохранить резервные копии",
              )
            }
          >
            <ResetIcon />
            <span>
              <strong>Кэш Discord</strong>
              <small>С резервной копией папок</small>
            </span>
          </button>
        </div>
        {(state.checks ?? []).map((check) => (
          <details className={styles.details} key={check.name}>
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
                {check.state}
              </Badge>{" "}
              {check.name}
            </summary>
            <pre>{check.detail}</pre>
          </details>
        ))}
      </Section>
      <p className={styles.footnote}>
        Закрытие GUI останавливает только процесс, запущенный этим приложением.
      </p>
    </div>
  );
}
