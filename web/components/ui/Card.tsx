import type { ReactNode } from "react";

type Props = { title?: string; action?: ReactNode; children: ReactNode; className?: string };

export function Card({ title, action, children, className = "" }: Props) {
  return (
    <section className={`rounded-token border border-border bg-surface p-5 shadow-card ${className}`}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-base font-bold">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
