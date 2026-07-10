import type { ButtonHTMLAttributes } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
};

export function Chip({ active, className = "", ...props }: ChipProps) {
  const base =
    "font-body font-medium text-sm rounded-chip border-2 px-3 py-1.5 cursor-pointer transition-colors";
  const state = active
    ? "bg-orange text-card border-ink"
    : "bg-card text-ink/40 line-through border-ink/30";
  return <button className={`${base} ${state} ${className}`} {...props} />;
}
