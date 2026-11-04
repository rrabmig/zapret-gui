import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

import { aliases } from "../aliases";

const config: StorybookConfig = {
  stories: ["../src/**/stories/*.stories.tsx"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "storybook-addon-pseudo-states",
  ],
  framework: "@storybook/react-vite",
  core: { disableTelemetry: true },
  viteFinal: (config) => mergeConfig(config, { resolve: { alias: aliases } }),
};
export default config;
