import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink as ExternalIcon } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getConversation } from "@/lib/queries/insights";
import { removeConversation } from "@/lib/actions/conversations";
import { Badge, Panel, PanelHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import { Excerpt, KindBadge, SourceBadge, StanceBadge } from "@/components/insight/bits";
import type { InsightKind, Stance } from "@/lib/domain/archaeology";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireViewer();
  const data = await getConversation(user.id, id);
  if (!data) notFound();

  const { conversation, messages, insights } = data;

  return (
    <div className="p-5 lg:p-6 max-w-[900px]">
      <Link
        href="/conversations"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint hover:text-ink mb-3"
      >
        <ArrowLeft size={13} /> Conversations
      </Link>

      <header className="mb-5">
        <h1 className="text-[21px] font-semibold tracking-[-0.02em] leading-tight">
          {conversation.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <SourceBadge source={conversation.source} />
          <span className="num text-[11.5px] text-ink-faint">
            {conversation.messageCount} messages
          </span>
          <span className="text-[11.5px] text-ink-faint">
            {(conversation.startedAt ?? conversation.capturedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {conversation.url ? (
            <a
              href={conversation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:text-accent-hot hover:underline underline-offset-2"
            >
              Open original
              <ExternalIcon size={10} />
            </a>
          ) : null}
          <div className="ml-auto">
            <form action={removeConversation}>
              <input type="hidden" name="id" value={conversation.id} />
              <ConfirmSubmit
                variant="danger"
                size="xs"
                confirmLabel="Delete — this cannot be undone"
              >
                Delete
              </ConfirmSubmit>
            </form>
          </div>
        </div>
        <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
          Deleting removes the transcript. Insights recovered from it lose this evidence and are
          recounted; any left with no evidence at all are removed.
        </p>
      </header>

      <div className="grid gap-4">
        {insights.length ? (
          <Panel>
            <PanelHeader
              title="Recovered from this conversation"
              subtitle="Each one quotes the line it came from."
            />
            <ul className="divide-y divide-line/70">
              {insights.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <KindBadge kind={row.kind as InsightKind} />
                    <StanceBadge stance={row.stance as Stance} />
                    <Link
                      href={`/ideas/${row.id}`}
                      className="text-[13px] text-ink hover:text-accent-hot transition-colors"
                    >
                      {row.title}
                    </Link>
                    {row.mentionCount > 1 ? (
                      <span className="num text-[11px] text-ink-faint">
                        {row.mentionCount}× across all chats
                      </span>
                    ) : null}
                  </div>
                  <Excerpt>“{row.excerpt}”</Excerpt>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            title="Transcript"
            subtitle="Stored exactly as captured. Extraction reads this; it never edits it."
          />
          <ol className="divide-y divide-line/70">
            {messages.map((message) => (
              <li key={message.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge tone={message.role === "user" ? "accent" : "neutral"}>
                    {message.role === "user" ? "You" : message.role}
                  </Badge>
                  {message.occurredAt ? (
                    <span className="num text-[10.5px] text-ink-faint">
                      {message.occurredAt.toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                </div>
                <p className="text-[12.5px] text-ink-muted leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
