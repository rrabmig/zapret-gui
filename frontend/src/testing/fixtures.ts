/** Imported only by Storybook/tests or Vite's explicit `fixtures` mode. All effects are in memory. */
import type { Action, Bridge, Config, Snapshot } from "@lib/bridge/types";
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
    dataDir: "C:\\Users\\Personal\\AppData\\Roaming\\GUIForZapret",
    config: {
      schema: 1,
      language: "ru",
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
      elevated: scenario !== "gui-update",
      running: false,
      serviceInstalled: false,
      serviceRunning: false,
      externalRunning: false,
      foreignServiceInstalled: false,
      message: JSON.stringify({ code: "bfeRunning", params: {} }),
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
        problem: JSON.stringify({ code: "error051", params: {} }),
      },
    ],
    versionsDir:
      "C:\\Users\\Personal\\AppData\\Local\\Programs\\GUIForZapret\\versions",
    versions: ["1.10.4", "1.10.3"].map((tag) => ({
      tag,
      downloadedAt: "2026-01-01T12:00:00Z",
      size: 10 * 1024 * 1024,
      strategy: "general.bat",
    })),
    fakes: ["quic_initial_www_google_com.bin"],
    logs: [
      {
        time: "12:00:00",
        message: { code: "startup", params: { value1: "0.2.0" } },
      },
      {
        time: "12:00:01",
        message: { code: "release", params: { value1: "1.10.4" } },
      },
      {
        time: "12:00:01",
        message: { code: "started", params: { value1: "general.bat" } },
      },
      { text: "winws: original output" },
    ],
    checks: [],
    latest: null,
    lastCheck: "",
    toolSession: false,
  };
  if (scenario === "running" || scenario === "slow-operation") {
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
    state.engine.message = JSON.stringify({ code: "error035", params: {} });
  }
  if (scenario === "empty") {
    state.config.active = "";
    state.config.previous = "";
    state.versions = [];
    state.strategies = [];
    state.fakes = [];
    state.logs = null;
    state.checks = null;
  }
  if (scenario === "status-error") {
    state.engine.statusError = "Access denied (fixture)";
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
  const stored = localStorage.getItem("fixture-language");
  if (stored === "en") state.config.language = "en";
  else if (stored) state.config.language = "ru";
  const calls: MockBridge["calls"] = [];
  window.__uiCalls = calls;
  const lists = new Map<string, string>();
  let cancelOperation: (() => void) | undefined;
  const clone = () => structuredClone(state);
  return {
    calls,
    Snapshot: async () => clone(),
    Action: async (action: Action, payload: string) => {
      calls.push({ action, payload });
      if (action === "diagnostics" && scenario === "slow-operation") {
        await new Promise<void>((resolve) => {
          cancelOperation = resolve;
        });
        throw new Error(
          JSON.stringify({ code: "operationCancelled", params: {} }),
        );
      }
      if (action === "cancel-operation") cancelOperation?.();
      if (scenario === "bridge-error")
        throw new Error(
          JSON.stringify({ code: "error026", params: { value1: "fixture" } }),
        );
      if (action === "check-gui-update")
        state.guiUpdate = {
          tag: "v0.3.0",
          url: "https://github.com/rrabmig/zapret-gui/releases/tag/v0.3.0",
          notes: "Update fixture notes",
          size: 12000000,
          available: true,
          ready: false,
          checked: "2026-01-01T12:00:00Z",
        };
      if (action === "download-gui-update" && state.guiUpdate)
        state.guiUpdate.ready = true;
      if (action === "language") {
        state.config.language = payload === "en" ? "en" : "ru";
        localStorage.setItem("fixture-language", state.config.language);
      }
      if (action === "settings")
        state.config = {
          ...(JSON.parse(payload) as Config),
          language: state.config.language,
        };
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
            name: "Flowseal",
            state: "ok",
            detail: JSON.stringify({ code: "diagnosticsReadOnly", params: {} }),
          },
        ];
      if (action === "check-updates" || action === "download-version")
        state.latest = {
          tag_name: "1.10.5",
          html_url: "",
          published_at: "2026-01-01T12:00:00Z",
          assets: [],
          draft: false,
          prerelease: false,
        };
      if (action === "check-updates") state.lastCheck = "2026-01-01T12:00:00Z";
      if (action === "download-version") {
        state.versions = [
          {
            tag: "1.10.5",
            downloadedAt: "2026-01-01T12:00:00Z",
            size: 12 * 1024 * 1024,
            strategy: "general.bat",
          },
          ...state.versions.filter((v) => v.tag !== "1.10.5"),
        ];
      }
      if (action === "delete-version") {
        state.versions = state.versions.filter((v) => v.tag !== payload);
        if (state.config.previous === payload) state.config.previous = "";
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
        : (lists.get(name) ?? "# User list\nexample.org\n"),
    SaveList: async (name, content) => {
      calls.push({ action: "save-list", payload: name });
      lists.set(name, content);
    },
  };
}
