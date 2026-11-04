import { openBuilds } from "@lib/bridge/desktop";
import type { Bridge } from "@lib/bridge/types";
import { I18nRoot, useI18n } from "@lib/i18n";

import { Button } from "@components/Button/Button";
import { Notice } from "@components/Notice/Notice";

import { AppShell } from "@screens/AppShell/AppShell";

import { AppProvider } from "./AppProvider";
import * as keyset from "./i18n";

import styles from "./App.module.css";
export interface IAppProps {
  bridge?: Bridge;
}
export function App(props: IAppProps) {
  return (
    <I18nRoot>
      <AppContent {...props} />
    </I18nRoot>
  );
}
interface IAppContentProps extends IAppProps {}
function AppContent({ bridge }: IAppContentProps) {
  const i18n = useI18n(keyset);
  if (!bridge)
    return (
      <main className={styles.loading}>
        <h1>GUI for zapret</h1>
        <Notice>
          {i18n(
            "Go-мост недоступен. Управление доступно в установленном приложении.",
          )}
        </Notice>
        <Button onClick={openBuilds}>{i18n("Скачать GUI")}</Button>
      </main>
    );
  return (
    <AppProvider bridge={bridge}>
      <AppShell />
    </AppProvider>
  );
}
