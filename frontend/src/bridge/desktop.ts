import type { Bridge } from "./types";
export function desktopBridge(): Bridge | undefined {
  return window.go?.main?.App;
}
export function openBuilds() {
  const url =
    "https://github.com/rrabmig/zapret-gui/actions/workflows/build.yml";
  if (window.runtime?.BrowserOpenURL) window.runtime.BrowserOpenURL(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
