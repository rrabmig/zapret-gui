import { Button } from "@components/Button/Button";
import { Card, Section } from "@components/Card/Card";

import { useApp } from "../../app/AppProvider";

import styles from "../../design/Page.module.css";
export interface IJournalProps {}
export function Journal(_props: IJournalProps) {
  const { state, refresh } = useApp();
  return (
    <Section
      title="События приложения"
      description="Последние 250 строк. Полный журнал — app.log в каталоге данных."
      action={<Button onClick={() => void refresh()}>Обновить</Button>}
    >
      <Card>
        <pre className={styles.log} tabIndex={0} aria-label="Журнал приложения">
          {state.logs?.join("\n") || "Пока нет записей."}
        </pre>
      </Card>
    </Section>
  );
}
