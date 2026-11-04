import { useState } from "react";

import { backendText } from "@lib/bridge/messages";
import { policy } from "@lib/bridge/policy";
import { renderText, useLanguage } from "@lib/i18n";
import { useI18n } from "@lib/i18n";

import { Badge } from "@components/Badge/Badge";
import { Card, Section } from "@components/Card/Card";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./i18n";

import styles from "../../design/Page.module.css";
export interface IStrategiesProps {}
export function Strategies(_props: IStrategiesProps) {
  const i18n = useI18n(keyset);
  const { state, act, hasEdits, notify } = useApp();
  const [query, setQuery] = useState("");
  const { language } = useLanguage();
  const p = policy(state);
  const shown = state.strategies.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Section
      title={i18n("Каталог стратегий")}
      description={i18n("count", { count: state.strategies.length })}
      action={
        <input
          type="search"
          aria-label={i18n("Поиск стратегий")}
          placeholder={i18n("Найти стратегию…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      }
    >
      <fieldset className={styles.radioList}>
        <legend className={styles.srOnly}>{i18n("Активная стратегия")}</legend>
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
                      i18n.message(
                        "Сохраните изменения списков и настроек перед выбором стратегии.",
                      ),
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
                    i18n.message("Стратегия выбрана. Движок не запущен."),
                  );
                }}
              />
              <span>
                <strong>{strategy.label}</strong>
                {strategy.problem && (
                  <small>
                    {renderText(backendText(strategy.problem), language)}
                  </small>
                )}
              </span>
              {state.config.strategy === strategy.name ? (
                <Badge>{i18n("Выбрана")}</Badge>
              ) : !strategy.compatible ? (
                <Badge tone="warning">
                  {i18n("Нужна оригинальная утилита")}
                </Badge>
              ) : null}
            </label>
          </Card>
        ))}
      </fieldset>
      {!shown.length && (
        <div className={styles.empty}>
          {state.strategies.length
            ? i18n("По запросу ничего не найдено.")
            : i18n(
                "Сначала установите официальный пакет в разделе «Обновления».",
              )}
        </div>
      )}
      <p className={styles.footnote}>
        {i18n(
          "Выбор сохраняется без запуска движка. Для изменения остановите движок, удалите службу и завершите оригинальные утилиты.",
        )}
      </p>
    </Section>
  );
}
