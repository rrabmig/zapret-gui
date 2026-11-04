import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { desktopBridge } from "./bridge/desktop";
import "./design/tokens.css";
import "./design/global.css";
async function main() {
  // Vite removes this branch and its separate fixture chunk from production builds.
  const bridge =
    import.meta.env.MODE === "fixtures"
      ? (await import("./testing/fixtures")).createMockBridge(
          new URLSearchParams(location.search).get("state") ?? "idle",
        )
      : desktopBridge();
  createRoot(document.getElementById("root")!).render(<App bridge={bridge} />);
}
void main();
