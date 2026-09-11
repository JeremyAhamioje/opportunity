"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Settings,
  Target,
  Zap,
} from "lucide-react";
import { CATEGORY_META, STAGE_META, type Category, type Stage } from "@/lib/domain/types";
import { URGENCY_META, type Urgency } from "@/lib/domain/dates";
import { KeyHint } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CommandItem } from "@/lib/queries/today";

type Entry = {
  id: string;
  label: string;
  hint?: string;
  group: "Actions" | "Go to" | "Opportunities";
  icon?: React.ReactNode;
  keywords?: string;
  urgency?: Urgency;
  run: () => void;
};

export function CommandPalette({
  onClose,
  onQuickAdd,
  items,
}: {
  onClose: () => void;
  onQuickAdd: () => void;
  items: CommandItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [lastQuery, setLastQuery] = useState(query);
  const listRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };

    const nav: Entry[] = [
      { id: "n-home", label: "Dashboard", group: "Go to", icon: <LayoutDashboard size={14} />, run: go("/") },
      { id: "n-today", label: "Today's Shots", group: "Go to", icon: <Target size={14} />, keywords: "daily execution", run: go("/today") },
      { id: "n-pipeline", label: "Pipeline", group: "Go to", icon: <KanbanSquare size={14} />, keywords: "kanban board stages", run: go("/pipeline") },
      { id: "n-opps", label: "Opportunities", group: "Go to", icon: <ListChecks size={14} />, keywords: "table list all", run: go("/opportunities") },
      { id: "n-companies", label: "Companies", group: "Go to", icon: <Building2 size={14} />, run: go("/companies") },
      { id: "n-import", label: "Research Import", group: "Go to", icon: <Search size={14} />, keywords: "deep research paste extract", run: go("/import") },
      { id: "n-finder", label: "Workflow Finder", group: "Go to", icon: <Zap size={14} />, keywords: "sop checklist inefficiency", run: go("/finder") },
      { id: "n-analytics", label: "Analytics", group: "Go to", icon: <BarChart3 size={14} />, keywords: "response rate which shots work", run: go("/analytics") },
      { id: "n-settings", label: "Settings", group: "Go to", icon: <Settings size={14} />, keywords: "goals weights password", run: go("/settings") },
    ];

    const actions: Entry[] = [
      {
        id: "a-add",
        label: "Add opportunity",
        hint: "N",
        group: "Actions",
        icon: <Plus size={14} />,
        keywords: "new create quick add job scholarship workflow",
        run: () => {
          onClose();
          onQuickAdd();
        },
      },
      {
        id: "a-followups",
        label: "Work the follow-up queue",
        group: "Actions",
        icon: <Target size={14} />,
        keywords: "due overdue chase",
        run: go("/today"),
      },
    ];

    const opportunities: Entry[] = items.map((item) => ({
      id: item.id,
      label: item.title,
      hint: item.company ?? undefined,
      group: "Opportunities",
      urgency: item.urgency,
      keywords: `${item.company ?? ""} ${CATEGORY_META[item.category as Category]?.short ?? ""} ${
        STAGE_META[item.stage as Stage]?.label ?? ""
      }`,
      run: () => {
        onClose();
        router.push(`/opportunities/${item.id}`);
      },
    }));

    return [...actions, ...nav, ...opportunities];
  }, [items, onClose, onQuickAdd, router]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries.slice(0, 40);
    const words = needle.split(/\s+/);
    return entries
      .filter((entry) => {
        const haystack = `${entry.label} ${entry.hint ?? ""} ${entry.keywords ?? ""}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .slice(0, 40);
  }, [entries, query]);

  // Retyping should put the highlight back on the first result. Adjusted
  // during render rather than in an effect, so no extra pass is scheduled.
  if (query !== lastQuery) {
    setLastQuery(query);
    setCursor(0);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((value) => Math.min(value + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((value) => Math.max(value - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        filtered[cursor]?.run();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filtered, cursor]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[560px] bg-surface border border-line-strong rounded-[10px] shadow-2xl shadow-black/60 overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-3.5 h-[44px] border-b border-line">
          <Search size={15} className="text-ink-faint shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search opportunities, or jump anywhere…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
          />
          <KeyHint>esc</KeyHint>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
              Nothing matches “{query}”.
            </p>
          ) : (
            filtered.map((entry, index) => {
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;
              return (
                <div key={entry.id}>
                  {showGroup ? (
                    <p className="px-3.5 pt-2.5 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.13em] text-ink-faint">
                      {entry.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-index={index}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => entry.run()}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3.5 h-[32px] text-left text-[12.5px] transition-colors",
                      index === cursor ? "bg-raised text-ink" : "text-ink-muted",
                    )}
                  >
                    <span className="text-ink-faint shrink-0 w-[14px] grid place-items-center">
                      {entry.urgency && entry.urgency !== "none" ? (
                        <span title={URGENCY_META[entry.urgency].label}>
                          {URGENCY_META[entry.urgency].dot}
                        </span>
                      ) : (
                        entry.icon
                      )}
                    </span>
                    <span className="truncate flex-1">{entry.label}</span>
                    {entry.hint ? (
                      <span className="text-[11px] text-ink-faint truncate max-w-[38%]">
                        {entry.hint}
                      </span>
                    ) : null}
                    {index === cursor ? (
                      <ArrowRight size={12} className="text-ink-faint shrink-0" />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
