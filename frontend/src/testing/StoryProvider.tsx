import { useMemo, type ReactNode } from "react";
import { AppProvider } from "../app/AppProvider";
import { createMockBridge } from "./fixtures";
export function StoryProvider({
  children,
  scenario = "idle",
  theme = "light",
}: {
  children: ReactNode;
  scenario?: string;
  theme?: string;
}) {
  const bridge = useMemo(() => {
    const mock = createMockBridge(scenario);
    const read = mock.Snapshot;
    mock.Snapshot = async () => ({
      ...(await read()),
      config: {
        ...(await read()).config,
        theme: theme === "dark" ? "dark" : "light",
      },
    });
    return mock;
  }, [scenario, theme]);
  return (
    <AppProvider key={`${scenario}-${theme}`} bridge={bridge}>
      {children}
    </AppProvider>
  );
}
