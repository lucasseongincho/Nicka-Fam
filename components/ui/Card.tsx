import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  dashed?: boolean;
};

export function Card({ dashed = false, className = "", ...props }: CardProps) {
  const base = dashed
    ? "border-2 border-dashed border-ink/30 rounded-card-sm text-ink/50"
    : "bg-card border-2 border-ink rounded-card shadow-card";
  return <div className={`${base} ${className}`} {...props} />;
}
