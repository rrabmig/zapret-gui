import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmDialog } from "../ConfirmDialog";
import { Button } from "../../Button/Button";
const meta = {
  title: "Design system/ConfirmDialog",
  component: ConfirmDialog,
  args: { confirmation: null, onResolve: () => {} },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Открыть подтверждение</Button>
      <ConfirmDialog
        confirmation={
          open
            ? {
                title: "Удалить службу?",
                body: "Служба ZapretDesktop будет остановлена и удалена.",
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
