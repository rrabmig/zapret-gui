import { policy } from "@lib/bridge/policy";
import { useI18n, useLanguage } from "@lib/i18n";

import { Badge } from "@components/Badge/Badge";
import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";
import { Notice } from "@components/Notice/Notice";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./i18n";

import styles from "../../design/Page.module.css";
export interface IUpdatesProps {}
export function Updates(_props: IUpdatesProps) {
  const i18n = useI18n(keyset);
  const { state, act } = useApp();
  const { language } = useLanguage();
  const p = policy(state);
  return (
    <div className={styles.stack}>
      <Section
        title={i18n("Официальный пакет")}
        description={i18n(
          "Flowseal / zapret-discord-youtube · стабильные релизы",
        )}
        action={
          <Button
            onClick={() =>
              void act(
                "check-updates",
                "",
                i18n.message("Метаданные релиза обновлены."),
              )
            }
          >
            {i18n("Проверить обновления")}
          </Button>
        }
      >
        <Card>
          <div className={styles.release}>
            <div>
              <span>{i18n("Установлено")}</span>
              <strong>{state.config.active || i18n("Не установлен")}</strong>
            </div>
            <div>
              <span>{i18n("Стабильный релиз")}</span>
              <strong>{state.latest?.tag_name || i18n("Не проверен")}</strong>
            </div>
            <div>
              <span>{i18n("Последняя проверка")}</span>
              <p>
                {state.lastCheck
                  ? new Date(state.lastCheck).toLocaleString(
                      language === "ru" ? "ru-RU" : "en-US",
                    )
                  : i18n("Ещё не выполнялась")}
              </p>
            </div>
          </div>
        </Card>
        <div className={styles.actionLine}>
          <p>
            {i18n("Официальный ZIP с проверкой SHA-256.")}
            <br />
            {i18n("После установки движок остаётся выключен.")}
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
                i18n.message(
                  "Официальный пакет установлен. Движок не запущен.",
                ),
              )
            }
          >
            {state.config.active
              ? i18n("Скачать и обновить")
              : i18n("Скачать и установить")}
          </Button>
        </div>
      </Section>
      <Section
        title={i18n("Установленные версии")}
        description={i18n("Предыдущие пакеты остаются для возврата.")}
        action={
          <Button
            disabled={!p.idle || !state.config.previous}
            onClick={() => void act("rollback")}
          >
            {i18n("Откатить версию")}
          </Button>
        }
      >
        <Card>
          {state.packages.map((tag) => (
            <div key={tag} className={styles.row}>
              <code>{tag}</code>
              {state.config.active === tag ? (
                <Badge tone="success">{i18n("Активна")}</Badge>
              ) : (
                <div className={styles.actions}>
                  {state.config.previous === tag && (
                    <Badge>{i18n("Предыдущая")}</Badge>
                  )}
                  <Button
                    disabled={!p.idle}
                    onClick={() => void act("activate", tag)}
                  >
                    {i18n("Использовать")}
                  </Button>
                </div>
              )}
            </div>
          ))}
          {!state.packages.length && (
            <div className={styles.empty}>
              {i18n("Пакеты ещё не установлены.")}
            </div>
          )}
        </Card>
      </Section>
      <Notice>
        {i18n(
          "GUI и движок обновляются отдельно. Настройки и пользовательские списки сохраняются при обновлении и откате.",
        )}
      </Notice>
    </div>
  );
}
