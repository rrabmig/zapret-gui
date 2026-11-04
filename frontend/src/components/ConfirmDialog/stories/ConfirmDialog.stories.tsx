import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "@components/Button/Button";

import { ConfirmDialog } from "../ConfirmDialog";
const meta = {
  title: "Design system/ConfirmDialog",
  component: ConfirmDialog,
  args: { confirmation: null, onResolve: () => {} },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
interface IExampleProps {}
function Example(_props: IExampleProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Открыть подтверждение</Button>
      <ConfirmDialog
        confirmation={
          open
            ? {
                title: "Удалить службу?",
                body: "Служба zapret, созданная этим GUI, будет остановлена и удалена.",
                label: "Удалить",
              }
            : null
        }
        onResolve={() => setOpen(false)}
      />
    </>
  );
}
export const Default: Story = { render: () => <Example /> };
