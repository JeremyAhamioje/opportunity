"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonClass, type ButtonSize, type ButtonVariant } from "./index";

/* -------------------------------------------------------------------------- */
/*  Submit button — disables and relabels itself while the action is in flight */
/* -------------------------------------------------------------------------- */

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "sm",
  className,
  ...props
}: ComponentProps<"button"> & {
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

/** Submits the surrounding form when its value changes — for inline selects. */
export function AutoSubmitSelect({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  const { pending } = useFormStatus();
  return (
    <select
      className={cn("field appearance-none cursor-pointer", className)}
      disabled={pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      {...props}
    >
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modal                                                                     */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first meaningful control so the keyboard path works immediately.
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]), textarea, select, button",
      );
      target?.focus();
    }, 10);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  }[width];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-black/70 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full bg-surface border border-line-strong rounded-[10px] shadow-2xl shadow-black/60 my-auto",
          widths,
        )}
      >
        <header className="flex items-start justify-between gap-4 px-4 py-3 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="text-[11.5px] text-ink-faint mt-0.5">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-faint hover:text-ink transition-colors -mr-1 -mt-0.5 p-1"
          >
            <X size={15} />
          </button>
        </header>
        {children}
        {footer ? (
          <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line bg-canvas/40 rounded-b-[10px]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Confirming submit — a second click before anything destructive happens     */
/* -------------------------------------------------------------------------- */

export function ConfirmSubmit({
  children,
  confirmLabel = "Click again to confirm",
  variant = "danger",
  size = "sm",
  className,
}: {
  children: ReactNode;
  confirmLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type={armed ? "submit" : "button"}
      disabled={pending}
      onClick={() => {
        if (!armed) setArmed(true);
      }}
      className={buttonClass(variant, size, className)}
    >
      {pending ? "Working…" : armed ? confirmLabel : children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Disclosure — collapsible section that remembers nothing, by design         */
/* -------------------------------------------------------------------------- */

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={cn("group", className)} open={defaultOpen}>
      <summary className="cursor-pointer list-none text-[12px] text-ink-muted hover:text-ink select-none flex items-center gap-1.5">
        <span className="text-ink-faint transition-transform group-open:rotate-90">▸</span>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export { Button };
