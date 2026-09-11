"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Crosshair, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const KEY = "occ.tour.dismissed.v1";

const STEPS = [
  {
    title: "Get opportunities in",
    body: "Search for companies or open roles under Discover, paste research from Claude or ChatGPT, or add one by hand with N. Everything lands as a draft you review first — nothing is written until you say so.",
    href: "/import",
    cta: "Open Research Import",
  },
  {
    title: "Take the shot, then log it",
    body: "When you actually email or apply, press Mark as sent on the opportunity. That one action schedules the follow-up, so the system can chase you instead of you trying to remember.",
    href: "/pipeline",
    cta: "See the pipeline",
  },
  {
    title: "Work the queue daily",
    body: "Today's Shots is the only screen you need most days: what is overdue, what is due, what is ready to send. The dashboard always names one next action — the thing it would cost most to ignore.",
    href: "/today",
    cta: "Open Today's Shots",
  },
];

/**
 * First-run orientation.
 *
 * Shown only to accounts with nothing in them, so it cannot interrupt someone
 * mid-work, and dismissal is remembered per browser. Deliberately three steps
 * about the loop — find, shoot, follow up — rather than a tour of every screen:
 * the screens are discoverable, the habit is not.
 */
export function WelcomeTour({ isNew }: { isNew: boolean }) {
  const [dismissed, setDismissed] = useState(() => {
    if (!isNew || typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(KEY) === "1";
    } catch {
      // Private windows and blocked site data throw rather than return null.
      return false;
    }
  });
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* nothing to do — it simply shows again next time */
    }
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label="Getting started"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] z-40 rounded-[10px] border border-line-strong bg-raised shadow-2xl shadow-black/60"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <Crosshair size={14} className="text-accent shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
          Getting started
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="ml-auto text-ink-faint hover:text-ink transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <p className="text-[13.5px] font-medium">{current.title}</p>
        <p className="text-[12px] text-ink-muted mt-1.5 leading-relaxed">{current.body}</p>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-line">
        <div className="flex items-center gap-1.5 mr-auto" aria-hidden>
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === step ? "w-4 bg-accent" : "w-1.5 bg-line-strong",
              )}
            />
          ))}
        </div>

        <Link
          href={current.href}
          onClick={close}
          className="text-[12px] text-accent hover:text-accent-hot hover:underline"
        >
          {current.cta}
        </Link>

        {last ? (
          <Button size="xs" onClick={close}>
            <Check size={12} />
            Done
          </Button>
        ) : (
          <Button size="xs" variant="secondary" onClick={() => setStep((n) => n + 1)}>
            Next
            <ArrowRight size={12} />
          </Button>
        )}
      </div>
    </div>
  );
}
