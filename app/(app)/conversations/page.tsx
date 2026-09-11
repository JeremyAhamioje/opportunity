import Link from "next/link";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getArchaeologySummary, listConversations } from "@/lib/queries/insights";
import { isAiConfigured } from "@/lib/parse/ai-config";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { PageHeader } from "@/components/opportunity/bits";
import { CaptureBox, ExtractButton, RetryExtraction } from "@/components/insight/capture";
import { SourceBadge } from "@/components/insight/bits";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  pending: "neutral",
  extracting: "accent",
  done: "good",
  failed: "bad",
  skipped: "neutral",
} as const;

export default async function ConversationsPage() {
  const { user } = await requireViewer();
  const [rows, summary] = await Promise.all([
    listConversations(user.id),
    getArchaeologySummary(user.id),
  ]);
  const aiConfigured = isAiConfigured();

  return (
    <div className="p-5 lg:p-6 max-w-[1080px]">
      <PageHeader
        title="Conversations"
        subtitle="The raw record. Captured chats are stored whole and never rewritten — every recovered idea points back to a line in here."
        action={<ExtractButton pending={summary.pending} aiConfigured={aiConfigured} />}
      />

      <div className="grid gap-4">
        <Panel>
          <PanelHeader
            title="Capture a conversation"
            subtitle="Paste a transcript or drop an export. The browser extension posts here too — see Settings → Browser capture."
          />
          <CaptureBox aiConfigured={aiConfigured} />
        </Panel>

        <Panel>
          <PanelHeader
            title="Captured"
            subtitle={
              summary.conversations
                ? `${summary.conversations} conversation${summary.conversations === 1 ? "" : "s"} · ${summary.insights} insights recovered`
                : undefined
            }
          />

          {rows.length === 0 ? (
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="Nothing captured yet"
              description="Paste a conversation above, or install the browser extension to save them as you go."
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {rows.map((row) => (
                <li key={row.id} className="px-4 py-2.5 flex items-center gap-3 row-link">
                  <Link href={`/conversations/${row.id}`} className="min-w-0 flex-1 group">
                    <span className="block text-[12.5px] text-ink group-hover:text-accent-hot transition-colors truncate">
                      {row.title}
                    </span>
                    <span className="flex items-center gap-2.5 mt-0.5">
                      <SourceBadge source={row.source} />
                      <span className="num text-[11px] text-ink-faint">
                        {row.messageCount} messages
                      </span>
                      <span className="text-[11px] text-ink-faint">
                        {(row.startedAt ?? row.capturedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </span>
                  </Link>

                  {row.status === "failed" ? (
                    <span
                      className="hidden sm:flex items-center gap-1.5 text-[11px] text-bad max-w-[240px] truncate"
                      title={row.error ?? undefined}
                    >
                      <AlertTriangle size={12} className="shrink-0" />
                      {row.error}
                    </span>
                  ) : row.status === "done" ? (
                    <span className="num text-[11px] text-ink-faint">
                      {row.insightCount} insight{row.insightCount === 1 ? "" : "s"}
                    </span>
                  ) : null}

                  <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                  {row.status === "failed" ? <RetryExtraction id={row.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
