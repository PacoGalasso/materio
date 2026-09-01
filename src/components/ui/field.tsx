import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export const controlClasses =
  "h-8 w-full rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-faint hover:border-ink-faint " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 " +
  "disabled:bg-surface-muted disabled:text-ink-muted disabled:hover:border-line-strong " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/25 read-only:bg-surface-muted";

interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  children: ReactNode;
  /** Right-aligned secondary content on the label row (e.g. a shortcut or a link). */
  trailing?: ReactNode;
}

/** Label + control + hint/error. Pass `error` and give the control `aria-describedby={fieldMessageId(id)}`. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  trailing,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-ink-secondary text-xs font-medium">
          {label}
          {required ? (
            <span className="text-ink-faint ml-0.5" aria-hidden>
              *
            </span>
          ) : null}
        </label>
        {trailing}
      </div>
      {children}
      {error ? (
        <p id={fieldMessageId(htmlFor)} role="alert" className="text-danger-text text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={fieldMessageId(htmlFor)} className="text-ink-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function fieldMessageId(id: string): string {
  return `${id}-message`;
}

interface InputProps extends ComponentProps<"input"> {
  invalid?: boolean;
  /** Unit suffix displayed inside the control (e.g. "kg", "CHF/kg"). */
  suffix?: ReactNode;
  numeric?: boolean;
}

export function Input({ invalid, suffix, numeric, className, id, ...props }: InputProps) {
  const input = (
    <input
      id={id}
      className={cn(
        controlClasses,
        numeric && "tnum text-right font-medium",
        suffix ? "pr-14" : undefined,
        className,
      )}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? fieldMessageId(id) : undefined}
      inputMode={numeric ? "decimal" : props.inputMode}
      autoComplete={numeric ? "off" : props.autoComplete}
      {...props}
    />
  );
  if (!suffix) return input;
  return (
    <div className="relative">
      {input}
      <span
        className="text-ink-muted pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
        aria-hidden
      >
        {suffix}
      </span>
    </div>
  );
}

interface TextareaProps extends ComponentProps<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, id, ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      className={cn(controlClasses, "h-auto min-h-16 resize-y py-1.5", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? fieldMessageId(id) : undefined}
      {...props}
    />
  );
}

interface SelectProps extends ComponentProps<"select"> {
  invalid?: boolean;
}

export function Select({ invalid, className, id, children, ...props }: SelectProps) {
  return (
    <select
      id={id}
      className={cn(
        controlClasses,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b727c%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px_12px] bg-[position:right_8px_center] bg-no-repeat pr-7",
        className,
      )}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? fieldMessageId(id) : undefined}
      {...props}
    >
      {children}
    </select>
  );
}
