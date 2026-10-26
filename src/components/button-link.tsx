import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

const variants = {
  primary: "bg-navy-800 text-white hover:bg-navy-900",
  accent: "bg-gold-500 text-navy-900 hover:bg-gold-300",
  outline: "border border-navy-800 text-navy-800 hover:bg-navy-50",
} as const;

type Props = ComponentProps<typeof Link> & { variant?: keyof typeof variants };

export function ButtonLink({ variant = "primary", className = "", ...props }: Props) {
  return (
    <Link
      className={`inline-flex min-h-12 items-center justify-center rounded-(--radius-control) px-6 font-display text-base font-semibold transition-colors ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
