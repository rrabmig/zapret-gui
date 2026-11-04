import { useId, type ReactNode } from "react";
import styles from "./Field.module.css";
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string, hintId: string | undefined) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field}>
      <div>
        <label htmlFor={id}>{label}</label>
        {hint && <p id={hintId}>{hint}</p>}
      </div>
      {children(id, hintId)}
    </div>
  );
}
export function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id, hintId) => (
        <input
          className={styles.switch}
          id={id}
          aria-describedby={hintId}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}
    </Field>
  );
}
