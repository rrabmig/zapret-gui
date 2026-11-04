import type { Meta, StoryObj } from "@storybook/react-vite";
import { Notice } from "../Notice";
const meta = {
  title: "Design system/Notice",
  component: Notice,
  tags: ["autodocs"],
  args: {
    children: "Настройки и пользовательские списки сохраняются при обновлении.",
  },
} satisfies Meta<typeof Notice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Success: Story = { args: { tone: "success" } };
export const Warning: Story = { args: { tone: "warning" } };
export const Error: Story = { args: { tone: "danger" } };
