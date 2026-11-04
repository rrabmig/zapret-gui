import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConnectionCard } from "../ConnectionCard";
import { snapshot } from "../../../testing/fixtures";
const meta = {
  title: "Components/ConnectionCard",
  component: ConnectionCard,
  args: { state: snapshot(), onToggle: () => {} },
} satisfies Meta<typeof ConnectionCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Running: Story = { args: { state: snapshot("running") } };
export const Unsupported: Story = { args: { state: snapshot("unsupported") } };
export const StatusError: Story = { args: { state: snapshot("status-error") } };
export const Service: Story = { args: { state: snapshot("service") } };
