import { useEffect, useRef } from "react";
import { Button } from "../Button/Button";
import styles from "./ConfirmDialog.module.css";
export interface Confirmation {
  title: string;
  body: string;
  label?: string;
}
export function ConfirmDialog({
  confirmation,
  onResolve,
}: {
  confirmation: Confirmation | null;
  onResolve: (value: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation && !ref.current?.open) ref.current?.showModal();
    else if (!confirmation) ref.current?.close();
  }, [confirmation]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-body"
      onCancel={(e) => {
        e.preventDefault();
        onResolve(false);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onResolve(true);
        }}
      >
        <p className={styles.eyebrow}>Zapret Desktop</p>
        <h2 id="confirmation-title">{confirmation?.title}</h2>
        <p id="confirmation-body">{confirmation?.body}</p>
        <div className={styles.actions}>
          <Button autoFocus onClick={() => onResolve(false)}>
            Отмена
          </Button>
          <Button type="submit" variant="primary">
            {confirmation?.label ?? "Продолжить"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
