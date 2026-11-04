import type { Meta, StoryObj } from "@storybook/react-vite";
import { AppShell } from "../AppShell";
import { StoryProvider } from "../../../testing/StoryProvider";
const meta = {
  title: "Screens/AppShell",
  component: AppShell,
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
  render: () => <AppShell />,
} satisfies Meta<typeof AppShell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Running: Story = { parameters: { scenario: "running" } };
export const Empty: Story = { parameters: { scenario: "empty" } };
export const Unsupported: Story = { parameters: { scenario: "unsupported" } };
