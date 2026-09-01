import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-100 select-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-ink-inverse border-ink hover:bg-ink-secondary hover:border-ink-secondary active:bg-ink",
  secondary:
    "bg-surface text-ink border-line-strong hover:bg-surface-muted hover:border-ink-faint active:bg-surface-sunken",
  ghost:
    "bg-transparent text-ink-secondary border-transparent hover:bg-surface-sunken hover:text-ink",
  danger:
    "bg-surface text-danger-text border-line-strong hover:bg-danger-soft hover:border-danger active:bg-danger-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-base",
};

export function buttonClasses(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  return cn(
    BASE,
    VARIANTS[options.variant ?? "secondary"],
    SIZES[options.size ?? "md"],
    options.className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function ButtonLink({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
