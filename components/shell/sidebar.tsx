"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Crosshair,
  Hammer,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
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

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  tone?: "urgent";
};

export function Sidebar({
  email,
  name,
  followUpsDue,
  overdue,
  activeCount,
  buildsDue,
  commitments,
  unreadConversations,
  className,
}: {
  email: string;
  name: string | null;
  followUpsDue: number;
  overdue: number;
  activeCount: number;
  buildsDue: number;
  commitments: number;
  /** Captured but not yet read — the only archaeology badge worth nagging about. */
  unreadConversations: number;
  /** Hidden below `lg`, where the pill nav in TopNav takes over. */
  className?: string;
}) {
  const pathname = usePathname();

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Command",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        {
          href: "/today",
          label: "Today's Shots",
          icon: Target,
          badge: followUpsDue || undefined,
          tone: overdue > 0 ? "urgent" : undefined,
        },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
        { href: "/opportunities", label: "Opportunities", icon: ListChecks, badge: activeCount || undefined },
        { href: "/companies", label: "Companies", icon: Building2 },
      ],
    },
    {
      label: "Make",
      items: [{ href: "/builds", label: "Builds", icon: Hammer, badge: buildsDue || undefined }],
    },
    {
      label: "Remember",
      items: [
        { href: "/ideas", label: "Ideas", icon: Lightbulb },
        {
          href: "/commitments",
          label: "You said you would",
          icon: Handshake,
          badge: commitments || undefined,
        },
        {
          href: "/conversations",
          label: "Conversations",
          icon: MessagesSquare,
          badge: unreadConversations || undefined,
        },
      ],
    },
    {
      label: "Find",
      items: [
        { href: "/import", label: "Research Import", icon: Search },
        { href: "/finder", label: "Workflow Finder", icon: Zap },
      ],
    },
    {
      label: "Learn",
      items: [{ href: "/analytics", label: "Analytics", icon: BarChart3 }],
    },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "w-[212px] shrink-0 border-r border-line bg-surface flex-col h-dvh sticky top-0",
        className,
      )}
    >
      <div className="px-3.5 h-[46px] flex items-center gap-2 border-b border-line">
        <Crosshair size={15} className="text-accent shrink-0" />
        <span className="text-[12px] font-semibold tracking-tight truncate">
          Command Center
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[9.5px] font-semibold uppercase tracking-[0.13em] text-ink-faint">
              {group.label}
            </p>
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 px-2 h-[29px] rounded-[5px] text-[12.5px] transition-colors",
                        active
                          ? "bg-raised text-ink font-medium"
                          : "text-ink-muted hover:text-ink hover:bg-raised/60",
                      )}
                    >
                      <Icon
                        size={14}
                        className={cn(
                          "shrink-0",
                          active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted",
                        )}
                      />
                      <span className="truncate flex-1">{item.label}</span>
                      {item.badge ? (
                        <span
                          className={cn(
                            "num text-[10px] px-1 h-[16px] min-w-[16px] inline-flex items-center justify-center rounded-[3px] font-semibold",
                            item.tone === "urgent"
                              ? "bg-overdue/15 text-overdue"
                              : "bg-[#22222a] text-ink-faint",
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-2 h-[29px] rounded-[5px] text-[12.5px] transition-colors mb-1",
            isActive("/settings")
              ? "bg-raised text-ink font-medium"
              : "text-ink-muted hover:text-ink hover:bg-raised/60",
          )}
        >
          <Settings size={14} className={isActive("/settings") ? "text-accent" : "text-ink-faint"} />
          Settings
        </Link>

        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="size-[22px] rounded-full bg-accent-dim text-[10px] font-semibold text-accent-hot grid place-items-center shrink-0">
            {(name ?? email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] truncate leading-tight">{name ?? "Owner"}</p>
            <p className="text-[10px] text-ink-faint truncate leading-tight">{email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="text-ink-faint hover:text-ink transition-colors p-1"
            >
              <LogOut size={13} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
