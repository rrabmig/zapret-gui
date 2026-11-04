import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card, Section } from "../Card";
const meta = {
  title: "Design system/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Card>
      <div style={{ padding: 20 }}>Текущая стратегия · general</div>
    </Card>
  ),
};
export const WithHeading: Story = {
  render: () => (
    <Section
      title="Установленные версии"
      description="Предыдущие пакеты остаются для возврата."
    >
      <Card>
        <div style={{ padding: 20 }}>1.10.4</div>
      </Card>
    </Section>
  ),
};
