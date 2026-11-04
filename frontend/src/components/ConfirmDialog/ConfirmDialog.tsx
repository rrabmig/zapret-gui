import { useEffect, useRef } from "react";

import { renderText, type Text, useI18n, useLanguage } from "@lib/i18n";

import { Button } from "@components/Button/Button";

import * as keyset from "./i18n";

import styles from "./ConfirmDialog.module.css";
export interface Confirmation {
  title: Text;
  body: Text;
  label?: Text;
}
export interface IConfirmDialogProps {
  confirmation: Confirmation | null;
  onResolve: (value: boolean) => void;
}
export function ConfirmDialog({
  confirmation,
  onResolve,
}: IConfirmDialogProps) {
  const i18n = useI18n(keyset);
  const { language } = useLanguage();
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
        <h2 id="confirmation-title">
          {confirmation && renderText(confirmation.title, language)}
        </h2>
        <p id="confirmation-body">
          {confirmation && renderText(confirmation.body, language)}
        </p>
        <div className={styles.actions}>
          <Button autoFocus onClick={() => onResolve(false)}>
            {i18n("Отмена")}
          </Button>
          <Button type="submit" variant="primary">
            {confirmation?.label
              ? renderText(confirmation.label, language)
              : i18n("Продолжить")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
