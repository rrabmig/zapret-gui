import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button";
const meta = {
  title: "Design system/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Сохранить настройки" },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Secondary: Story = {};
export const Primary: Story = { args: { variant: "primary" } };
export const Danger: Story = {
  args: { variant: "danger", children: "Удалить службу" },
};
export const Quiet: Story = { args: { variant: "quiet" } };
export const Disabled: Story = { args: { variant: "primary", disabled: true } };
