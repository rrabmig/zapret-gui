import { useState } from "react";
import { useApp } from "../../app/AppProvider";
import { policy } from "../../lib/bridge/policy";
import { Badge } from "../../components/Badge/Badge";
import { Card, Section } from "../../components/Card/Card";
import styles from "../../design/Page.module.css";
export interface IStrategiesProps {}
export function Strategies(_props: IStrategiesProps) {
  const { state, act, hasEdits, notify } = useApp();
  const [query, setQuery] = useState("");
  const p = policy(state);
  const shown = state.strategies.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Section
      title="Каталог стратегий"
      description={`${state.strategies.length} стратегий из официального пакета`}
      action={
        <input
          type="search"
          aria-label="Поиск стратегий"
          placeholder="Найти стратегию…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      }
    >
      <fieldset className={styles.radioList}>
        <legend className={styles.srOnly}>Активная стратегия</legend>
        {shown.map((strategy) => (
          <Card key={strategy.name}>
            <label
              className={`${styles.strategy} ${state.config.strategy === strategy.name ? styles.selected : ""}`}
            >
              <input
                type="radio"
                name="strategy"
                checked={state.config.strategy === strategy.name}
                disabled={!strategy.compatible || !p.idle}
                onChange={() => {
                  if (hasEdits()) {
                    notify(
                      "Сохраните изменения списков и настроек перед выбором стратегии.",
                      "warning",
                    );
                    return;
                  }
                  void act(
                    "settings",
                    JSON.stringify({
                      ...state.config,
                      strategy: strategy.name,
                    }),
                    "Стратегия выбрана. Движок не запущен.",
                  );
                }}
              />
              <span>
                <strong>{strategy.label}</strong>
                {strategy.problem && <small>{strategy.problem}</small>}
              </span>
              {state.config.strategy === strategy.name ? (
                <Badge>Выбрана</Badge>
              ) : !strategy.compatible ? (
                <Badge tone="warning">Нужна оригинальная утилита</Badge>
              ) : null}
            </label>
          </Card>
        ))}
      </fieldset>
      {!shown.length && (
        <div className={styles.empty}>
          {state.strategies.length
            ? "По запросу ничего не найдено."
            : "Сначала установите официальный пакет в разделе «Обновления»."}
        </div>
      )}
      <p className={styles.footnote}>
        Выбор сохраняется без запуска движка. Для изменения остановите движок,
        удалите службу и завершите оригинальные утилиты.
      </p>
    </Section>
  );
}
