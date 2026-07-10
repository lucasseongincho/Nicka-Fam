import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "font-heading font-semibold rounded-pill border-[2.5px] border-ink px-5 py-3 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-orange text-card shadow-button hover:bg-orange-dark",
    ghost: "bg-transparent text-ink hover:bg-ink/5",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
