import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import { I18nProvider, normalizeLanguage } from "@lib/i18n";

import "../src/design/tokens.css";
import "../src/design/global.css";
interface IThemeProps {
  theme: string;
  children: React.ReactNode;
}
function Theme({ theme, children }: IThemeProps) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <div style={{ padding: 24 }}>{children}</div>;
}
const preview: Preview = {
  globalTypes: {
    language: {
      description: "Language / Язык",
      toolbar: {
        icon: "globe",
        items: [
          { value: "ru", title: "Русский" },
          { value: "en", title: "English" },
        ],
      },
    },
    theme: {
      description: "Оформление",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Светлая" },
          { value: "dark", title: "Тёмная" },
        ],
      },
    },
  },
  initialGlobals: { language: "ru", theme: "light", a11y: { manual: true } },
  decorators: [
    (Story, context) => (
      <I18nProvider language={normalizeLanguage(context.globals.language)}>
        <Theme theme={context.globals.theme}>
          <Story />
        </Theme>
      </I18nProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { context: "#storybook-root" },
  },
};
export default preview;
