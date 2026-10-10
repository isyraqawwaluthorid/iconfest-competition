import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost"; active?: boolean };

export function Button({ variant = "primary", active = false, className = "", ...props }: Props) {
  const look =
    variant === "primary" || active
      ? "bg-primary text-on-primary border-primary"
      : "bg-surface text-text border-border hover:border-primary";
  return (
    <button
      type="button"
      {...props}
      className={`rounded-token border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${look} ${className}`}
    />
  );
}
