import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost"; active?: boolean };

export function Button({ variant = "primary", active = false, className = "", ...props }: Props) {
  const look =
    variant === "primary" || active
      ? "bg-primary text-on-primary border-primary hover:bg-primary-strong"
      : "bg-surface text-text border-border hover:border-primary hover:text-primary";
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-2 rounded-control border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${look} ${className}`}
    />
  );
}
