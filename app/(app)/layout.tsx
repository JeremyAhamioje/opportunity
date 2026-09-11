import { requireViewer } from "@/lib/auth/guard";
import { getSummary } from "@/lib/queries/opportunities";
import { getCommandIndex } from "@/lib/queries/today";
import { getBuilds } from "@/lib/queries/builds";
import { getArchaeologySummary } from "@/lib/queries/insights";
import { Sidebar } from "@/components/shell/sidebar";
import { TopNav } from "@/components/shell/top-nav";
import { AppChrome } from "@/components/shell/app-chrome";

export const dynamic = "force-dynamic";

/**
 * Two shells, one app.
 *
 *   lg and up — the sidebar, which can hold nine destinations with their labels
 *               and badges permanently visible.
 *   below lg  — no sidebar. A Notion-style pill nav at the top where only the
 *               active section is labelled, and a floating bar at the bottom
 *               carrying the two things you do constantly: search and add.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireViewer();
  const [summary, commandItems, builds, archaeology] = await Promise.all([
    getSummary(user.id),
    getCommandIndex(user.id),
    getBuilds(user.id),
    getArchaeologySummary(user.id),
  ]);
  const buildsDue = builds.dueCheckIns.length;

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        className="hidden lg:flex"
        email={user.email}
        name={user.name}
        followUpsDue={summary.followUpsDue}
        overdue={summary.overdue}
        activeCount={summary.active}
        buildsDue={buildsDue}
        commitments={archaeology.commitments}
        unreadConversations={archaeology.pending}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopNav
          className="lg:hidden"
          email={user.email}
          name={user.name}
          followUpsDue={summary.followUpsDue}
          overdue={summary.overdue}
          buildsDue={buildsDue}
          commitments={archaeology.commitments}
        />
        <AppChrome items={commandItems} overdue={summary.overdue} />
        {/* Bottom padding clears the floating bar, which only exists on mobile. */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">{children}</main>
      </div>
    </div>
  );
}
