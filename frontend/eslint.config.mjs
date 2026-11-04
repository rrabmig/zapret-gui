import babelParser from "@babel/eslint-parser";
import importSort from "eslint-plugin-simple-import-sort";

import { importGroups } from "./eslint/import-groups.mjs";

const parserOptions = (jsx = false) => ({
  requireConfigFile: false,
  babelOptions: {
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: jsx ? ["typescript", "jsx"] : ["typescript"] },
  },
});

export default [
  {
    ignores: [
      "**/i18n/ru.ts",
      "**/i18n/en.ts",
      "**/i18n/index.ts",
      "node_modules/**",
      "dist/**",
      "dist-fixtures/**",
      "storybook-static/**",
      "playwright-report/**",
      "test-results/**",
      "wailsjs/**",
    ],
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      ".storybook/**/*.{ts,tsx}",
      "*.ts",
      "eslint/**/*.mjs",
      "eslint.config.mjs",
    ],
    plugins: { "simple-import-sort": importSort },
    rules: {
      "simple-import-sort/imports": ["error", { groups: importGroups }],
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: { parser: babelParser, parserOptions: parserOptions() },
  },
  {
    files: ["**/*.tsx"],
    languageOptions: {
      parser: babelParser,
      parserOptions: parserOptions(true),
    },
  },
];
