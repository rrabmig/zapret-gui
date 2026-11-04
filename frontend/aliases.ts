import { fileURLToPath } from "node:url";

/** Shared by Vite and Storybook; keep names aligned with tsconfig paths. */
export const aliases = {
  "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
  "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
  "@screens": fileURLToPath(new URL("./src/screens", import.meta.url)),
};
