"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Modal built on the native <dialog>: focus trap, Escape and backdrop come from the browser. */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "bg-surface shadow-dialog m-auto w-full max-w-lg rounded-md p-0 text-ink backdrop:bg-transparent",
        className,
      )}
    >
      <div className="flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="border-line-soft flex items-start justify-between gap-4 border-b px-5 py-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-ink-muted mt-0.5 text-xs">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-ink-muted hover:bg-surface-sunken hover:text-ink -mr-2 flex size-7 items-center justify-center rounded-sm"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}
