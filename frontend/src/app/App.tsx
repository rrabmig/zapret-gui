import type { Bridge } from "../bridge/types";
import { openBuilds } from "../bridge/desktop";
import { Button } from "../components/Button/Button";
import { Notice } from "../components/Notice/Notice";
import { AppProvider } from "./AppProvider";
import { AppShell } from "../screens/AppShell/AppShell";
import styles from "./App.module.css";
export function App({ bridge }: { bridge?: Bridge }) {
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
      <Desktop />
    </AppProvider>
  );
}
function Desktop() {
  return <AppShell />;
}
