import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "../Badge";
const meta = {
  title: "Design system/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Остановлен" },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Neutral: Story = {};
export const Success: Story = {
  args: { tone: "success", children: "Работает" },
};
export const Warning: Story = {
  args: { tone: "warning", children: "Статус неизвестен" },
};
export const Danger: Story = { args: { tone: "danger", children: "Ошибка" } };
