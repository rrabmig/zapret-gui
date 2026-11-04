import { type ReactNode, useMemo } from "react";

import { AppProvider } from "../app/AppProvider";
import { createMockBridge } from "./fixtures";
export interface IStoryProviderProps {
  children: ReactNode;
  scenario?: string;
  theme?: string;
}
export function StoryProvider({
  children,
  scenario = "idle",
  theme = "light",
}: IStoryProviderProps) {
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
