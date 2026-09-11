"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Hammer,
  Handshake,
  Home,
  KanbanSquare,
  Lightbulb,
  ListChecks,
  LogOut,
  MessagesSquare,
  Search,
  Settings,
  Target,
  Zap,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  urgent?: boolean;
};

/**
 * Notion's pill navigation, in place of a sidebar: the section you are in
 * carries its label, everything else is an icon until you hover it. It keeps
 * nine destinations in a single 44px strip and hands the full width back to
 * the content.
 */
export function TopNav({
  email,
  name,
  followUpsDue,
  overdue,
  buildsDue,
  commitments,
  className,
}: {
  email: string;
  name: string | null;
  followUpsDue: number;
  overdue: number;
  buildsDue: number;
  commitments: number;
  /** Hidden at `lg` and up, where the sidebar takes over. */
  className?: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const items: Item[] = [
    { href: "/", label: "Home", icon: Home },
    {
      href: "/today",
      label: "Today",
      icon: Target,
      badge: followUpsDue || undefined,
      urgent: overdue > 0,
    },
    { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    { href: "/opportunities", label: "Opportunities", icon: ListChecks },
    { href: "/companies", label: "Companies", icon: Building2 },
    { href: "/builds", label: "Builds", icon: Hammer, badge: buildsDue || undefined },
    { href: "/ideas", label: "Ideas", icon: Lightbulb },
    {
      href: "/commitments",
      label: "Commitments",
      icon: Handshake,
      badge: commitments || undefined,
    },
    { href: "/conversations", label: "Conversations", icon: MessagesSquare },
    { href: "/import", label: "Import", icon: Search },
    { href: "/finder", label: "Finder", icon: Zap },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className={cn("sticky top-0 z-30 bg-canvas/90 backdrop-blur-md", className)}>
      <div className="flex items-center gap-1.5 px-3 h-[52px]">
        {/* Outside the scroller on purpose: `overflow-x: auto` forces the other
            axis off `visible`, so a menu hung off this button would be clipped
            to the 52px strip. Only the pills scroll. */}
        <div
          className="relative shrink-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setMenuOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title={email}
            aria-label="Account"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="size-[30px] rounded-full border border-line-strong grid place-items-center text-[12px] font-medium text-ink-muted hover:bg-hover hover:text-ink transition-colors"
          >
            {(name ?? email).slice(0, 1).toUpperCase()}
          </button>

          {menuOpen ? (
            <div className="absolute left-0 top-[38px] w-[212px] rounded-lg border border-line-strong bg-raised shadow-2xl shadow-black/60 p-1 z-40">
              <p className="px-2.5 py-2 text-[11.5px] text-ink-faint truncate border-b border-line mb-1">
                {email}
              </p>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-2.5 h-[30px] rounded-md text-[13px] text-ink-muted hover:bg-hover hover:text-ink transition-colors"
              >
                <Settings size={14} /> Settings
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-2.5 h-[30px] rounded-md text-[13px] text-ink-muted hover:bg-hover hover:text-ink transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                title={item.label}
                className="nav-pill shrink-0"
              >
                <Icon size={15} className="shrink-0" />
                {active ? <span>{item.label}</span> : null}
                {item.badge ? (
                  <span
                    className={cn(
                      "num text-[10.5px] px-1 h-[16px] min-w-[16px] inline-flex items-center justify-center rounded-full font-semibold",
                      item.urgent ? "bg-overdue/20 text-overdue" : "bg-white/10 text-ink-muted",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/settings"
          data-active={isActive("/settings")}
          title="Settings"
          className="nav-pill shrink-0"
        >
          <Settings size={15} />
          {isActive("/settings") ? <span>Settings</span> : null}
        </Link>
      </div>
    </header>
  );
}
