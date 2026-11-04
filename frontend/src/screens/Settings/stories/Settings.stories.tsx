import type { Meta, StoryObj } from "@storybook/react-vite";

import { StoryProvider } from "../../../testing/StoryProvider";
import { Settings } from "../Settings";
const meta = {
  title: "Screens/Settings",
  component: Settings,
  decorators: [
    (Story, context) => (
      <StoryProvider
        scenario={context.parameters.scenario ?? "idle"}
        theme={context.globals.theme}
      >
        <Story />
      </StoryProvider>
    ),
  ],
  render: () => <Settings />,
} satisfies Meta<typeof Settings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Running: Story = { parameters: { scenario: "running" } };
export const Empty: Story = { parameters: { scenario: "empty" } };
export const Unsupported: Story = { parameters: { scenario: "unsupported" } };
