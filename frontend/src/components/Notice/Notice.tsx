import { InfoCircledIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import type { Tone } from "@components/Badge/Badge";

import styles from "./Notice.module.css";
export interface INoticeProps {
  children: ReactNode;
  tone?: Tone;
}
export function Notice({ children, tone = "neutral" }: INoticeProps) {
  return (
    <div
      className={`${styles.notice} ${styles[tone]}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <InfoCircledIcon width={16} height={16} />
      <div>{children}</div>
    </div>
  );
}
