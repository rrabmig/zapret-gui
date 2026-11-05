import type { MouseEvent } from "react";

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

/** Keep real links in browser contexts; open explicit user clicks in the OS browser in Wails. */
export function openExternalLink(event: MouseEvent<HTMLAnchorElement>) {
  if (window.runtime?.BrowserOpenURL) {
    event.preventDefault();
    window.runtime.BrowserOpenURL(event.currentTarget.href);
  }
}
