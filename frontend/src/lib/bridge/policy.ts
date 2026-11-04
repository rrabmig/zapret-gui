import type { Snapshot } from "./types";
export function policy(s: Snapshot) {
  const e = s.engine;
  const idle =
    !e.running &&
    !e.serviceRunning &&
    !e.serviceInstalled &&
    !e.externalRunning &&
    !e.foreignServiceInstalled &&
    !s.toolSession &&
    !e.statusError;
  const allowed = e.supported && s.config.engineAllowed && !e.statusError;
  const running = e.running || e.serviceRunning;
  return {
    idle,
    allowed,
    running,
    packaged: !!s.config.active,
    canToggle:
      e.running ||
      (e.serviceRunning
        ? allowed && !s.toolSession
        : allowed && !!s.config.active && idle),
    status: e.statusError
      ? "unknown"
      : running
        ? "running"
        : !e.supported
          ? "unsupported"
          : s.config.engineAllowed
            ? "stopped"
            : "inspection",
    description: e.statusError
      ? "statusError"
      : !e.supported
        ? "unsupportedHint"
        : !s.config.active
          ? "installHint"
          : !s.config.engineAllowed
            ? "permissionHint"
            : e.foreignServiceInstalled
              ? "foreignHint"
              : e.externalRunning && !e.serviceRunning
                ? "externalHint"
                : s.toolSession
                  ? "toolsHint"
                  : running
                    ? "runningHint"
                    : !e.elevated
                      ? "elevateHint"
                      : "readyHint",
  } as const;
}
