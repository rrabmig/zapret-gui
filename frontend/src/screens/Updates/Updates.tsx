import { policy } from "@lib/bridge/policy";

import { Badge } from "@components/Badge/Badge";
import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";
import { Notice } from "@components/Notice/Notice";

import { useApp } from "../../app/AppProvider";

import styles from "../../design/Page.module.css";
export interface IUpdatesProps {}
export function Updates(_props: IUpdatesProps) {
  const { state, act } = useApp();
  const p = policy(state);
  return (
    <div className={styles.stack}>
      <Section
        title="Официальный пакет"
        description="Flowseal / zapret-discord-youtube · стабильные релизы"
        action={
          <Button
            onClick={() =>
              void act("check-updates", "", "Метаданные релиза обновлены.")
            }
          >
            Проверить обновления
          </Button>
        }
      >
        <Card>
          <div className={styles.release}>
            <div>
              <span>Установлено</span>
              <strong>{state.config.active || "Не установлен"}</strong>
            </div>
            <div>
              <span>Стабильный релиз</span>
              <strong>{state.latest?.tag_name || "Не проверен"}</strong>
            </div>
            <div>
              <span>Последняя проверка</span>
              <p>
                {state.lastCheck
                  ? new Date(state.lastCheck).toLocaleString("ru-RU")
                  : "Ещё не выполнялась"}
              </p>
            </div>
          </div>
        </Card>
        <div className={styles.actionLine}>
          <p>
            Официальный ZIP с проверкой SHA-256.
            <br />
            После установки движок остаётся выключен.
          </p>
          <Button
            variant="primary"
            disabled={
              !p.idle ||
              (!!state.latest && state.latest.tag_name === state.config.active)
            }
            onClick={() =>
              void act(
                "install-update",
                "",
                "Официальный пакет установлен. Движок не запущен.",
              )
            }
          >
            {state.config.active
              ? "Скачать и обновить"
              : "Скачать и установить"}
          </Button>
        </div>
      </Section>
      <Section
        title="Установленные версии"
        description="Предыдущие пакеты остаются для возврата."
        action={
          <Button
            disabled={!p.idle || !state.config.previous}
            onClick={() => void act("rollback")}
          >
            Откатить версию
          </Button>
        }
      >
        <Card>
          {state.packages.map((tag) => (
            <div key={tag} className={styles.row}>
              <code>{tag}</code>
              {state.config.active === tag ? (
                <Badge tone="success">Активна</Badge>
              ) : (
                <div className={styles.actions}>
                  {state.config.previous === tag && <Badge>Предыдущая</Badge>}
                  <Button
                    disabled={!p.idle}
                    onClick={() => void act("activate", tag)}
                  >
                    Использовать
                  </Button>
                </div>
              )}
            </div>
          ))}
          {!state.packages.length && (
            <div className={styles.empty}>Пакеты ещё не установлены.</div>
          )}
        </Card>
      </Section>
      <Notice>
        GUI и движок обновляются отдельно. Настройки и пользовательские списки
        сохраняются при обновлении и откате.
      </Notice>
    </div>
  );
}
