import { LightningBoltIcon, PlayIcon, StopIcon } from "@radix-ui/react-icons";

import { policy } from "@lib/bridge/policy";
import type { Snapshot } from "@lib/bridge/types";
import { useI18n } from "@lib/i18n";

import { Badge } from "@components/Badge/Badge";
import { Button } from "@components/Button/Button";

import * as keyset from "./i18n";

import styles from "./ConnectionCard.module.css";
export interface IConnectionCardProps {
  state: Snapshot;
  onToggle: () => void;
}
export function ConnectionCard({ state, onToggle }: IConnectionCardProps) {
  const i18n = useI18n(keyset);
  const p = policy(state);
  return (
    <div className={`${styles.connection} ${p.running ? styles.running : ""}`}>
      <div className={styles.top}>
        <Badge
          tone={
            state.engine.statusError
              ? "warning"
              : p.running
                ? "success"
                : "neutral"
          }
        >
          {i18n(p.status)}
        </Badge>
        <span className={styles.version}>
          Flowseal {state.config.active || i18n("не установлен")}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.power}>
          <LightningBoltIcon width={28} height={28} />
        </div>
        <div className={styles.copy}>
          <h2>
            {state.engine.statusError
              ? i18n("Состояние неизвестно")
              : p.running
                ? i18n("Движок работает")
                : i18n("Движок не запущен")}
          </h2>
          <p>
            {p.description === "runningHint"
              ? `Flowseal ${state.config.active} · ${state.config.strategy}`
              : i18n(p.description, {
                  detail: state.engine.statusError ?? "",
                  os: state.os,
                })}
          </p>
        </div>
      </div>
      <div className={styles.bottom}>
        <div>
          <span>{i18n("Текущая стратегия")}</span>
          <strong>{state.config.strategy.replace(/\.bat$/i, "")}</strong>
        </div>
        <Button variant="primary" disabled={!p.canToggle} onClick={onToggle}>
          {p.running ? <StopIcon /> : <PlayIcon />}
          {p.running ? i18n("Остановить") : i18n("Запустить")}
        </Button>
      </div>
    </div>
  );
}
