"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PenSquare, Plus, Search } from "lucide-react";
import { KeyHint } from "@/components/ui";
import { formatLongDay, today } from "@/lib/domain/dates";
import { CommandPalette } from "./command-palette";
import { QuickAdd } from "./quick-add";
import { cn } from "@/lib/utils";
import type { CommandItem } from "@/lib/queries/today";

const GO_TO: Record<string, string> = {
  d: "/",
  t: "/today",
  p: "/pipeline",
  o: "/opportunities",
  c: "/companies",
  b: "/builds",
  i: "/import",
  f: "/finder",
  a: "/analytics",
  s: "/settings",
  // Archaeology: `e` for ideas (`i` is taken by Import), `y` for "you said
  // you would", `v` for conversations.
  e: "/ideas",
  y: "/commitments",
  v: "/conversations",
};

/**
 * Owns every global interaction: the command palette, quick add, and the
 * keyboard shortcuts that make both reachable without the mouse.
 *
 * The controls sit in a floating bar at the bottom rather than a sidebar —
 * search on the left, take-a-shot on the right — so the two things you do
 * constantly are always in the same place, whatever screen you are on.
 */
export function AppChrome({ items, overdue }: { items: CommandItem[]; overdue: number }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const openAdd = useCallback(() => setAddOpen(true), []);

  useEffect(() => {
    const typing = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
    };

    let chord = false;
    let chordTimer: number | undefined;

    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event.target)) return;

      // `g` then a letter jumps between sections.
      if (chord) {
        const href = GO_TO[event.key.toLowerCase()];
        chord = false;
        window.clearTimeout(chordTimer);
        if (href) {
          event.preventDefault();
          router.push(href);
        }
        return;
      }

      if (event.key.toLowerCase() === "g") {
        chord = true;
        chordTimer = window.setTimeout(() => {
          chord = false;
        }, 1200);
        return;
      }

      if (event.key.toLowerCase() === "n" && !addOpen && !paletteOpen) {
        event.preventDefault();
        setAddOpen(true);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(chordTimer);
    };
  }, [router, addOpen, paletteOpen]);

  return (
    <>
      {/* Desktop: a slim bar above the content, beside the sidebar. */}
      <header className="hidden lg:flex h-[46px] shrink-0 border-b border-line bg-canvas/85 backdrop-blur-md sticky top-0 z-30 items-center gap-3 px-4">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-2 h-[30px] pl-2.5 pr-2 rounded-md bg-white/[0.055] hover:bg-white/[0.08] text-ink-faint hover:text-ink-muted transition-colors w-[280px] max-w-[36vw]"
        >
          <Search size={13} className="shrink-0" />
          <span className="text-[12.5px] flex-1 text-left truncate">Search or jump to…</span>
          <KeyHint>⌘K</KeyHint>
        </button>

        <div className="flex-1" />

        {overdue > 0 ? (
          <span className="flex items-center gap-1.5 text-[12px] text-overdue">
            <span className="size-[6px] rounded-full bg-overdue pulse-urgent" />
            <span className="num font-semibold">{overdue}</span> overdue
          </span>
        ) : null}

        <span className="text-[12px] text-ink-faint">{formatLongDay(today())}</span>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-[30px] px-3 rounded-md bg-accent hover:bg-accent-hot text-white text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus size={14} />
          Add opportunity
          <KeyHint>N</KeyHint>
        </button>
      </header>

      {/* Mobile: the floating bar replaces the sidebar's utility. */}
      <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pointer-events-none px-3 w-full justify-center">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          className="pointer-events-auto size-[42px] shrink-0 rounded-full border border-line-strong bg-raised/95 backdrop-blur-md text-ink-muted hover:text-ink hover:bg-hover transition-colors grid place-items-center shadow-xl shadow-black/40"
        >
          <Search size={17} />
        </button>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="pointer-events-auto h-[42px] px-4 rounded-full border border-line-strong bg-raised/95 backdrop-blur-md flex items-center gap-2.5 text-ink-muted hover:text-ink hover:bg-hover transition-colors shadow-xl shadow-black/40 min-w-[230px]"
        >
          {overdue > 0 ? (
            <span className="size-[7px] rounded-full bg-overdue pulse-urgent shrink-0" />
          ) : null}
          <span className="text-[13px] flex-1 text-left truncate">
            {overdue > 0
              ? `${overdue} overdue — search or jump to…`
              : "Search or jump to…"}
          </span>
          <KeyHint>⌘K</KeyHint>
        </button>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add opportunity"
          title="Add opportunity — N"
          className={cn(
            "pointer-events-auto size-[42px] shrink-0 rounded-full grid place-items-center transition-colors shadow-xl shadow-black/40",
            "bg-accent text-white hover:bg-accent-hot",
          )}
        >
          <PenSquare size={17} />
        </button>
      </div>

      {/* Mounted only while open, so closing genuinely resets their state
          instead of needing effects to clear it. */}
      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onQuickAdd={openAdd}
          items={items}
        />
      ) : null}
      {addOpen ? <QuickAdd onClose={() => setAddOpen(false)} /> : null}
    </>
  );
}
