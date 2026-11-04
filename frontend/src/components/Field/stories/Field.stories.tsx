import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Field, Switch } from "../Field";
const meta = {
  title: "Design system/Field",
  component: Field,
  args: { label: "Поле", children: (id) => <input id={id} /> },
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Text: Story = {
  render: () => (
    <Field label="Порты TCP" hint="Диапазоны и отдельные порты через запятую.">
      {(id, hint) => (
        <input id={id} aria-describedby={hint} defaultValue="1024-65535" />
      )}
    </Field>
  ),
};
export const Select: Story = {
  render: () => (
    <Field label="Оформление">
      {(id) => (
        <select id={id}>
          <option>Системная</option>
          <option>Светлая</option>
          <option>Тёмная</option>
        </select>
      )}
    </Field>
  ),
};
interface IInteractiveSwitchProps {}
function InteractiveSwitch(_props: IInteractiveSwitchProps) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      label="Разрешить запуск движка"
      hint="Только на Windows."
      checked={checked}
      onChange={setChecked}
    />
  );
}
export const Toggle: Story = { render: () => <InteractiveSwitch /> };
export const Disabled: Story = {
  render: () => (
    <Switch
      label="Разрешить запуск движка"
      checked={false}
      disabled
      onChange={() => {}}
    />
  ),
};
