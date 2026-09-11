"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { CATEGORIES, CATEGORY_META, STAGES, STAGE_META } from "@/lib/domain/types";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "score", label: "Highest score" },
  { value: "followup", label: "Follow-up date" },
  { value: "deadline", label: "Deadline" },
  { value: "company", label: "Company A–Z" },
] as const;

/**
 * Filters live in the URL, so every view is linkable and survives a reload —
 * and the server does the filtering, so there is no second copy of the rules.
 */
export function FilterBar({
  industries,
  sizes,
  total,
}: {
  industries: string[];
  sizes: string[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const first = useRef(true);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounce the text box so typing does not fire a request per keystroke.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => set("q", query.trim()), 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const active = [...params.keys()].filter((key) => key !== "sort").length;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[210px] max-w-[340px]">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search companies, roles, problems…"
          className="field pl-7.5 pr-7 h-[30px] py-0"
          style={{ paddingLeft: "1.85rem" }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      <Select
        aria-label="Category"
        value={params.get("category") ?? "all"}
        onChange={(event) => set("category", event.target.value)}
        className="h-[30px] py-0 w-auto"
      >
        <option value="all">All categories</option>
        {CATEGORIES.map((value) => (
          <option key={value} value={value}>
            {CATEGORY_META[value].short}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Stage"
        value={params.get("stage") ?? "all"}
        onChange={(event) => set("stage", event.target.value)}
        className="h-[30px] py-0 w-auto"
      >
        <option value="all">All stages</option>
        {STAGES.map((value) => (
          <option key={value} value={value}>
            {STAGE_META[value].short}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Status"
        value={params.get("status") ?? "all"}
        onChange={(event) => set("status", event.target.value)}
        className="h-[30px] py-0 w-auto"
      >
        <option value="all">Open & closed</option>
        <option value="open">Open only</option>
        <option value="closed">Closed only</option>
      </Select>

      {industries.length ? (
        <Select
          aria-label="Industry"
          value={params.get("industry") ?? "all"}
          onChange={(event) => set("industry", event.target.value)}
          className="h-[30px] py-0 w-auto"
        >
          <option value="all">Any industry</option>
          {industries.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      ) : null}

      {sizes.length ? (
        <Select
          aria-label="Company size"
          value={params.get("size") ?? "all"}
          onChange={(event) => set("size", event.target.value)}
          className="h-[30px] py-0 w-auto"
        >
          <option value="all">Any size</option>
          {sizes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        aria-label="Minimum score"
        value={params.get("minScore") ?? "0"}
        onChange={(event) => set("minScore", event.target.value === "0" ? "" : event.target.value)}
        className="h-[30px] py-0 w-auto"
      >
        <option value="0">Any score</option>
        <option value="80">80+ 🔥</option>
        <option value="60">60+</option>
        <option value="40">40+</option>
      </Select>

      <Select
        aria-label="Added"
        value={params.get("added") ?? "all"}
        onChange={(event) => set("added", event.target.value)}
        className="h-[30px] py-0 w-auto"
      >
        <option value="all">Any date</option>
        <option value="1">Added today</option>
        <option value="7">Added this week</option>
        <option value="30">Added this month</option>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={cn(
            "num text-[11.5px] transition-opacity",
            pending ? "text-ink-faint opacity-60" : "text-ink-faint",
          )}
        >
          {total} {total === 1 ? "result" : "results"}
        </span>

        <Select
          aria-label="Sort"
          value={params.get("sort") ?? "recent"}
          onChange={(event) => set("sort", event.target.value)}
          className="h-[30px] py-0 w-auto"
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </Select>

        {active > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className="text-[11.5px] text-ink-faint hover:text-ink transition-colors whitespace-nowrap"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
