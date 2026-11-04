import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Card.module.css";
export interface ICardProps extends HTMLAttributes<HTMLDivElement> {}
export function Card({ children, className = "", ...props }: ICardProps) {
  return (
    <div {...props} className={`${styles.card} ${className}`}>
      {children}
    </div>
  );
}
export interface ISectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}
export function Section({
  title,
  description,
  action,
  children,
}: ISectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
