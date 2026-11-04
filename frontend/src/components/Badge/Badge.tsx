import type { ReactNode } from "react";
import styles from "./Badge.module.css";
export type Tone = "neutral" | "success" | "warning" | "danger";
export interface IBadgeProps {
  children: ReactNode;
  tone?: Tone;
}
export function Badge({ children, tone = "neutral" }: IBadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
