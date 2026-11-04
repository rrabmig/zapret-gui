import { useEffect } from "react";
import type { Preview } from "@storybook/react-vite";
import "../src/design/tokens.css";
import "../src/design/global.css";
function Theme({
  theme,
  children,
}: {
  theme: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return <div style={{ padding: 24 }}>{children}</div>;
}
const preview: Preview = {
  globalTypes: {
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
  initialGlobals: { theme: "light", a11y: { manual: true } },
  decorators: [
    (Story, context) => (
      <Theme theme={context.globals.theme}>
        <Story />
      </Theme>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    a11y: { context: "#storybook-root" },
  },
};
export default preview;
