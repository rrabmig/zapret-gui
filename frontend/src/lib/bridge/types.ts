/** JSON contract of app.go and internal/core. No runtime or generated binding imports. */
export interface Config {
  schema: number;
  active: string;
  previous: string;
  strategy: string;
  engineAllowed: boolean;
  autoCheck: boolean;
  language?: "ru" | "en";
  theme: "system" | "light" | "dark";
  gameMode: "disabled" | "all" | "tcp" | "udp";
  gameTCP: string;
  gameUDP: string;
  ipset: "loaded" | "none" | "any";
  discordFake: string;
  gameFake: string;
}
export interface EngineState {
  supported: boolean;
  elevated: boolean;
  running: boolean;
  serviceInstalled: boolean;
  serviceRunning: boolean;
  externalRunning: boolean;
  foreignServiceInstalled: boolean;
  statusError?: string;
  message: string;
}
export interface Strategy {
  name: string;
  label: string;
  compatible: boolean;
  problem?: string;
}
export interface Check {
  name: string;
  state: string;
  detail: string;
}
export interface Release {
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: {
    name: string;
    browser_download_url: string;
    digest: string;
    size: number;
  }[];
}
export interface Snapshot {
  version: string;
  os: string;
  arch: string;
  dataDir: string;
  config: Config;
  engine: EngineState;
  strategies: Strategy[];
  packages: string[];
  fakes: string[];
  logs:
    | {
        time?: string;
        text?: string;
        message?: { code: string; params: Record<string, string> };
      }[]
    | null;
  checks: Check[] | null;
  latest: Release | null;
  lastCheck: string;
  toolSession: boolean;
}
export type Action =
  | "language"
  | "settings"
  | "start"
  | "stop"
  | "service-install"
  | "service-start"
  | "service-stop"
  | "service-remove"
  | "check-updates"
  | "install-update"
  | "activate"
  | "rollback"
  | "diagnostics"
  | "update-ipset"
  | "preview-hosts"
  | "apply-hosts"
  | "tests"
  | "menu"
  | "tools-finished"
  | "elevate"
  | "clear-discord-cache";
export interface Bridge {
  Snapshot(): Promise<Snapshot>;
  Action(action: Action, payload: string): Promise<Snapshot>;
  ReadList(name: string): Promise<string>;
  SaveList(name: string, content: string): Promise<void>;
}
declare global {
  interface Window {
    go?: { main?: { App?: Bridge } };
    runtime?: { BrowserOpenURL(url: string): void };
  }
}
