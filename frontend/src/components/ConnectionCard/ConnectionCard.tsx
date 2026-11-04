import { PlayIcon, StopIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import type { Snapshot } from "../../lib/bridge/types";
import { policy } from "../../lib/bridge/policy";
import { Button } from "../Button/Button";
import { Badge } from "../Badge/Badge";
import styles from "./ConnectionCard.module.css";
export interface IConnectionCardProps {
  state: Snapshot;
  onToggle: () => void;
}
export function ConnectionCard({ state, onToggle }: IConnectionCardProps) {
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
          {p.status}
        </Badge>
        <span className={styles.version}>
          Flowseal {state.config.active || "не установлен"}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.power}>
          <LightningBoltIcon width={28} height={28} />
        </div>
        <div className={styles.copy}>
          <h2>
            {state.engine.statusError
              ? "Состояние неизвестно"
              : p.running
                ? "Движок работает"
                : "Движок не запущен"}
          </h2>
          <p>{p.description}</p>
        </div>
      </div>
      <div className={styles.bottom}>
        <div>
          <span>Текущая стратегия</span>
          <strong>{state.config.strategy.replace(/\.bat$/i, "")}</strong>
        </div>
        <Button variant="primary" disabled={!p.canToggle} onClick={onToggle}>
          {p.running ? <StopIcon /> : <PlayIcon />}
          {p.running ? "Остановить" : "Запустить"}
        </Button>
      </div>
    </div>
  );
}
