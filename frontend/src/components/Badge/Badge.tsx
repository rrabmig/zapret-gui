import type { ReactNode } from "react";
import styles from "./Badge.module.css";
export type Tone = "neutral" | "success" | "warning" | "danger";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
