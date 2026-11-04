/** Imported only by Storybook/tests or Vite's explicit `fixtures` mode. All effects are in memory. */
import type { Action, Bridge, Config, Snapshot } from "../lib/bridge/types";
export const scenarios = [
  "idle",
  "running",
  "service",
  "unsupported",
  "empty",
  "status-error",
  "tool-session",
] as const;
export type Scenario = (typeof scenarios)[number];
export function snapshot(scenario = "idle"): Snapshot {
  const state: Snapshot = {
    version: "0.2.0 · UI fixture",
    os: "windows",
    arch: "amd64",
    dataDir: "C:\\Users\\Personal\\AppData\\Roaming\\ZapretDesktop",
    config: {
      schema: 1,
      active: "1.10.4",
      previous: "1.10.3",
      strategy: "general.bat",
      engineAllowed: false,
      autoCheck: false,
      theme: "system",
      gameMode: "disabled",
      gameTCP: "1024-65535",
      gameUDP: "1024-65535",
      ipset: "loaded",
      discordFake: "",
      gameFake: "",
    },
    engine: {
      supported: true,
      elevated: true,
      running: false,
      serviceInstalled: false,
      serviceRunning: false,
      externalRunning: false,
      foreignServiceInstalled: false,
      message: "Готов к ручному запуску",
    },
    strategies: [
      { name: "general.bat", label: "general", compatible: true },
      { name: "general (ALT2).bat", label: "general (ALT2)", compatible: true },
      {
        name: "general (FAKE TLS AUTO).bat",
        label: "general (FAKE TLS AUTO)",
        compatible: true,
      },
      {
        name: "general (NEW).bat",
        label: "general (NEW)",
        compatible: false,
        problem: "Новый формат аргументов. Используйте оригинальное меню.",
      },
    ],
    packages: ["1.10.4", "1.10.3"],
    fakes: ["quic_initial_www_google_com.bin"],
    logs: [
      "12:00:00  Zapret Desktop · автоматический запуск выключен",
      "12:00:01  Официальный пакет 1.10.4 готов",
      "12:00:01  Выбрана стратегия general.bat",
    ],
    checks: [],
    latest: null,
    lastCheck: "",
    toolSession: false,
  };
  if (scenario === "running") {
    state.engine.running = true;
    state.config.engineAllowed = true;
  }
  if (scenario === "service") {
    state.engine.serviceInstalled = true;
    state.engine.serviceRunning = true;
    state.config.engineAllowed = true;
  }
  if (scenario === "unsupported") {
    state.os = "darwin";
    state.arch = "arm64";
    state.engine.supported = false;
    state.engine.message = "Windows-движок недоступен на macOS.";
  }
  if (scenario === "empty") {
    state.config.active = "";
    state.config.previous = "";
    state.packages = [];
    state.strategies = [];
    state.fakes = [];
    state.logs = null;
    state.checks = null;
  }
  if (scenario === "status-error") {
    state.engine.statusError =
      "Не удалось прочитать состояние службы. Проверьте права доступа.";
    state.config.engineAllowed = true;
  }
  if (scenario === "tool-session") {
    state.toolSession = true;
    state.config.engineAllowed = true;
  }
  return state;
}
declare global {
  interface Window {
    __uiCalls?: { action: string; payload: string }[];
  }
}
export interface MockBridge extends Bridge {
  calls: { action: string; payload: string }[];
}
export function createMockBridge(scenario = "idle"): MockBridge {
  const state = snapshot(scenario);
  const calls: MockBridge["calls"] = [];
  window.__uiCalls = calls;
  const lists = new Map<string, string>();
  const clone = () => structuredClone(state);
  return {
    calls,
    Snapshot: async () => clone(),
    Action: async (action: Action, payload: string) => {
      calls.push({ action, payload });
      if (scenario === "bridge-error")
        throw new Error("Не удалось сохранить: тестовая ошибка моста");
      if (action === "settings") state.config = JSON.parse(payload) as Config;
      if (action === "start") state.engine.running = true;
      if (action === "stop") state.engine.running = false;
      if (action === "service-install") {
        state.engine.serviceInstalled = true;
        state.engine.serviceRunning = true;
      }
      if (action === "service-start") state.engine.serviceRunning = true;
      if (action === "service-stop") state.engine.serviceRunning = false;
      if (action === "service-remove") {
        state.engine.serviceInstalled = false;
        state.engine.serviceRunning = false;
      }
      if (action === "tests" || action === "menu") state.toolSession = true;
      if (action === "tools-finished") state.toolSession = false;
      if (action === "diagnostics")
        state.checks = [
          {
            name: "Официальный пакет",
            state: "ok",
            detail:
              "Файлы доступны. Инертный пример: системные и сетевые вызовы отсутствуют.",
          },
        ];
      if (action === "check-updates" || action === "install-update")
        state.latest = {
          tag_name: "1.10.5",
          html_url: "",
          published_at: "2026-01-01T12:00:00Z",
          assets: [],
          draft: false,
          prerelease: false,
        };
      if (action === "check-updates") state.lastCheck = "2026-01-01T12:00:00Z";
      if (action === "install-update") {
        state.config.previous = state.config.active;
        state.config.active = "1.10.5";
        state.packages = [
          "1.10.5",
          ...state.packages.filter((tag) => tag !== "1.10.5"),
        ];
      }
      if (action === "activate" || action === "rollback") {
        const previous = state.config.active;
        state.config.active =
          action === "activate" ? payload : state.config.previous;
        state.config.previous = previous;
      }
      return clone();
    },
    ReadList: async (name) =>
      name === "hosts-preview"
        ? "# BEGIN ZapretDesktop\n127.0.0.1 example.org\n# END ZapretDesktop"
        : (lists.get(name) ?? "# Пользовательский список\nexample.org\n"),
    SaveList: async (name, content) => {
      calls.push({ action: "save-list", payload: name });
      lists.set(name, content);
    },
  };
}
