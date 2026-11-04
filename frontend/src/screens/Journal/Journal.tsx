import { backendText } from "@lib/bridge/messages";
import { renderText, useLanguage } from "@lib/i18n";
import { useI18n } from "@lib/i18n";

import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";

import { useApp } from "../../app/AppProvider";
import * as keyset from "./.i18n";

import styles from "../../design/Page.module.css";
export interface IJournalProps {}
export function Journal(_props: IJournalProps) {
  const i18n = useI18n(keyset);
  const { language } = useLanguage();
  const { state, refresh } = useApp();
  return (
    <Section
      title={i18n("События приложения")}
      description={i18n(
        "Последние 250 строк. Полный журнал — app.log в каталоге данных.",
      )}
      action={
        <Button onClick={() => void refresh()}>{i18n("Обновить")}</Button>
      }
    >
      <Card>
        <pre
          className={styles.log}
          tabIndex={0}
          aria-label={i18n("Журнал приложения")}
        >
          {state.logs
            ?.map((line) => {
              return line.message
                ? `${line.time ?? ""}  ${renderText(backendText(JSON.stringify(line.message)), language)}`
                : (line.text ?? "");
            })
            .join("\n") || i18n("Пока нет записей.")}
        </pre>
      </Card>
    </Section>
  );
}
