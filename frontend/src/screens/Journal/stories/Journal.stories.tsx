import type { Meta, StoryObj } from "@storybook/react-vite";
import { Journal } from "../Journal";
import { StoryProvider } from "../../../testing/StoryProvider";
const meta = {
  title: "Screens/Journal",
  component: Journal,
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
  render: () => <Journal />,
} satisfies Meta<typeof Journal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Running: Story = { parameters: { scenario: "running" } };
export const Empty: Story = { parameters: { scenario: "empty" } };
export const Unsupported: Story = { parameters: { scenario: "unsupported" } };
