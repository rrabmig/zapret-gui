import { openBuilds } from "@lib/bridge/desktop";
import type { Bridge } from "@lib/bridge/types";

import { Button } from "@components/Button/Button";
import { Notice } from "@components/Notice/Notice";

import { AppShell } from "@screens/AppShell/AppShell";

import { AppProvider } from "./AppProvider";

import styles from "./App.module.css";
export interface IAppProps {
  bridge?: Bridge;
}
export function App({ bridge }: IAppProps) {
  if (!bridge)
    return (
      <main className={styles.loading}>
        <h1>Zapret Desktop</h1>
        <Notice>
          Go-мост недоступен. Управление доступно в установленном приложении.
        </Notice>
        <Button onClick={openBuilds}>Скачать приложение</Button>
      </main>
    );
  return (
    <AppProvider bridge={bridge}>
      <AppShell />
    </AppProvider>
  );
}
