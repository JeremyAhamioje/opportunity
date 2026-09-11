import Link from "next/link";
import {
  INSIGHT_KINDS,
  INSIGHT_KIND_META,
  STANCES,
  STANCE_META,
} from "@/lib/domain/archaeology";
import { cn } from "@/lib/utils";

export type IdeaView = "all" | "recurring" | "forgotten" | "promoted" | "archived";

export type IdeaSearch = {
  view: IdeaView;
  kind: string | null;
  stance: string | null;
  q: string | null;
  sort: string | null;
};

/**
 * Every filter lives in the URL, so any view is bookmarkable — the same rule
 * the opportunities table follows. Rendered server-side as links rather than a
 * client form: there is no state here that the address bar cannot hold.
 */
export function IdeaFilters({ search }: { search: IdeaSearch }) {
  const href = (patch: Partial<IdeaSearch>) => {
    const next = { ...search, ...patch };
    const params = new URLSearchParams();
    if (next.view && next.view !== "all") params.set("view", next.view);
    if (next.kind) params.set("kind", next.kind);
    if (next.stance) params.set("stance", next.stance);
    if (next.q) params.set("q", next.q);
    if (next.sort) params.set("sort", next.sort);
    const query = params.toString();
    return query ? `/ideas?${query}` : "/ideas";
  };

  const VIEWS: { id: IdeaView; label: string; hint: string }[] = [
    { id: "all", label: "Everything", hint: "Every insight recovered so far" },
    {
      id: "recurring",
      label: "Recurring",
      hint: "Mentioned three or more times. A signal of interest, not of value.",
    },
    {
      id: "forgotten",
      label: "Forgotten",
      hint: "Developed, never dropped, and gone quiet for a month",
    },
    { id: "promoted", label: "Promoted", hint: "Already turned into real work" },
    { id: "archived", label: "Archived", hint: "Set aside by you" },
  ];

  return (
    <div className="grid gap-2.5 mb-4">
      <div className="flex flex-wrap items-center gap-1">
        {VIEWS.map((view) => (
          <Link
            key={view.id}
            href={href({ view: view.id })}
            title={view.hint}
            data-active={search.view === view.id}
            className="nav-pill"
          >
            {view.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action="/ideas" className="contents">
          {search.view !== "all" ? (
            <input type="hidden" name="view" value={search.view} />
          ) : null}
          {search.kind ? <input type="hidden" name="kind" value={search.kind} /> : null}
          {search.stance ? <input type="hidden" name="stance" value={search.stance} /> : null}
          <input
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Search titles and summaries…"
            className="field h-[30px] py-0 max-w-[280px]"
          />
        </form>

        <Chip href={href({ kind: null })} active={!search.kind}>
          All kinds
        </Chip>
        {INSIGHT_KINDS.map((kind) => (
          <Chip
            key={kind}
            href={href({ kind })}
            active={search.kind === kind}
            title={INSIGHT_KIND_META[kind].blurb}
          >
            <span aria-hidden>{INSIGHT_KIND_META[kind].icon}</span>
            {INSIGHT_KIND_META[kind].plural}
          </Chip>
        ))}

        <span className="w-px h-4 bg-line-strong mx-1" aria-hidden />

        <Chip href={href({ stance: null })} active={!search.stance}>
          Any stance
        </Chip>
        {STANCES.map((stance) => (
          <Chip
            key={stance}
            href={href({ stance })}
            active={search.stance === stance}
            title={STANCE_META[stance].hint}
          >
            {STANCE_META[stance].label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  title,
  children,
}: {
  href: string;
  active: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full text-[11.5px] border transition-colors",
        active
          ? "bg-white/[0.095] border-line-strong text-ink"
          : "border-line text-ink-muted hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
