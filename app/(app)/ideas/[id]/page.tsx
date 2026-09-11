import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink as ExternalIcon, Pin } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getInsight } from "@/lib/queries/insights";
import {
  deleteInsight,
  rejectLink,
  setInsightStatus,
  togglePinned,
} from "@/lib/actions/insights";
import { INSIGHT_KIND_META, LINK_KIND_META, type LinkKind } from "@/lib/domain/archaeology";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import {
  ConfidenceHint,
  Excerpt,
  InsightLink,
  KindBadge,
  MentionCount,
  MovementMark,
  SourceBadge,
  StanceBadge,
} from "@/components/insight/bits";
import { EditInsightForm, PromoteButton } from "@/components/insight/insight-forms";

export const dynamic = "force-dynamic";

export default async function InsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireViewer();
  const data = await getInsight(user.id, id);
  if (!data) notFound();

  const { insight, mentions, links, promoted } = data;
  const duplicates = links.filter((link) => link.kind === "duplicate_of");
  const related = links.filter((link) => link.kind !== "duplicate_of");

  return (
    <div className="p-5 lg:p-6 max-w-[1080px]">
      <Link
        href="/ideas"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint hover:text-ink mb-3"
      >
        <ArrowLeft size={13} /> Ideas
      </Link>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <KindBadge kind={insight.kind} />
          <StanceBadge stance={insight.stance} />
          {insight.status === "promoted" ? <Badge tone="good">Promoted</Badge> : null}
          {insight.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
          <ConfidenceHint confidence={insight.confidence} />
          {insight.edited ? (
            <Badge tone="neutral" title="You have edited this. Extraction will not overwrite it.">
              Yours
            </Badge>
          ) : null}
        </div>

        <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight">
          {insight.title}
        </h1>

        {insight.summary ? (
          <p className="text-[13px] text-ink-muted mt-1.5 leading-relaxed max-w-[68ch]">
            {insight.summary}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
          <MentionCount count={insight.mentionCount} />
          {insight.firstSeenAt ? (
            <span className="text-[11.5px] text-ink-faint">
              first raised{" "}
              {insight.firstSeenAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          ) : null}
          {insight.dueDate ? (
            <span className="num text-[11.5px] text-duetoday">
              you said: {insight.dueDate}
            </span>
          ) : null}

          <div className="flex items-center gap-2 ml-auto">
            <form action={togglePinned}>
              <input type="hidden" name="id" value={insight.id} />
              <Button type="submit" variant="ghost" size="xs">
                <Pin size={12} />
                {insight.pinned ? "Unpin" : "Pin"}
              </Button>
            </form>
            <PromoteButton insight={insight} />
          </div>
        </div>

        {promoted ? (
          <p className="mt-3 text-[12px] text-ink-muted">
            Became{" "}
            <Link
              href={`/opportunities/${promoted.id}`}
              className="text-accent hover:text-accent-hot hover:underline underline-offset-2"
            >
              {promoted.title}
            </Link>
            .
          </p>
        ) : null}
      </header>

      <div className="grid xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="grid gap-4">
          {/* Provenance first: it is the answer to "why does the system think
              I wanted this?", and it must never sit below the app's own prose. */}
          <Panel>
            <PanelHeader
              title="Where this came from"
              subtitle={`${mentions.length} mention${mentions.length === 1 ? "" : "s"}, oldest first. Every line is quoted from your own conversations.`}
            />
            {mentions.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-ink-faint text-center">
                No evidence left — the conversations this came from were deleted.
              </p>
            ) : (
              <ol className="divide-y divide-line/70">
                {mentions.map((mention) => (
                  <li key={mention.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <span className="num text-[11px] text-ink-faint">
                        {mention.occurredAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <MovementMark movement={mention.movement} />
                      <Link
                        href={`/conversations/${mention.conversationId}`}
                        className="text-[11.5px] text-accent hover:text-accent-hot hover:underline underline-offset-2 truncate max-w-[280px]"
                      >
                        {mention.conversationTitle}
                      </Link>
                      <SourceBadge source={mention.conversationSource} />
                      {mention.conversationUrl ? (
                        <a
                          href={mention.conversationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink-faint hover:text-ink"
                          title="Open the original conversation"
                        >
                          <ExternalIcon size={11} />
                        </a>
                      ) : null}
                    </div>
                    <Excerpt>“{mention.excerpt}”</Excerpt>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {insight.detail ? (
            <Panel>
              <PanelHeader title="Detail" />
              <p className="px-4 py-3 text-[12.5px] text-ink-muted leading-relaxed whitespace-pre-wrap">
                {insight.detail}
              </p>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              title="Edit"
              subtitle="Extraction proposed this. Anything you change here is yours and will not be overwritten."
            />
            <EditInsightForm insight={insight} />
          </Panel>
        </div>

        <div className="grid gap-4">
          {duplicates.length ? (
            <Panel>
              <PanelHeader
                title="Possibly the same thing"
                subtitle="Suggested, never applied automatically."
              />
              <ul className="divide-y divide-line/70">
                {duplicates.map((link) => (
                  <li key={link.linkId} className="px-4 py-2.5">
                    <InsightLink
                      id={link.insight.id}
                      title={link.insight.title}
                      kind={link.insight.kind}
                    />
                    {link.reason ? (
                      <p className="text-[11px] text-ink-faint mt-1">{link.reason}</p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-2">
                      <Link
                        href="/ideas/duplicates"
                        className="text-[11.5px] text-accent hover:text-accent-hot hover:underline underline-offset-2"
                      >
                        Review
                      </Link>
                      <form action={rejectLink}>
                        <input type="hidden" name="linkId" value={link.linkId} />
                        <Button type="submit" variant="ghost" size="xs">
                          Keep separate
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {related.length ? (
            <Panel>
              <PanelHeader title="Connected" />
              <ul className="divide-y divide-line/70">
                {related.map((link) => (
                  <li key={link.linkId} className="px-4 py-2.5">
                    <p className="text-[10.5px] uppercase tracking-[0.09em] text-ink-faint mb-1">
                      {link.direction === "out"
                        ? LINK_KIND_META[link.kind as LinkKind].label
                        : LINK_KIND_META[link.kind as LinkKind].inverse}
                    </p>
                    <InsightLink
                      id={link.insight.id}
                      title={link.insight.title}
                      kind={link.insight.kind}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Status" />
            <div className="px-4 py-3 grid gap-2">
              <p className="text-[11.5px] text-ink-faint leading-relaxed">
                {INSIGHT_KIND_META[insight.kind].blurb}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {insight.status !== "archived" ? (
                  <form action={setInsightStatus}>
                    <input type="hidden" name="id" value={insight.id} />
                    <input type="hidden" name="status" value="archived" />
                    <Button type="submit" variant="ghost" size="xs">
                      Archive
                    </Button>
                  </form>
                ) : (
                  <form action={setInsightStatus}>
                    <input type="hidden" name="id" value={insight.id} />
                    <input type="hidden" name="status" value="open" />
                    <Button type="submit" variant="ghost" size="xs">
                      Restore
                    </Button>
                  </form>
                )}
                <form action={setInsightStatus}>
                  <input type="hidden" name="id" value={insight.id} />
                  <input type="hidden" name="status" value="done" />
                  <Button type="submit" variant="ghost" size="xs">
                    Mark done
                  </Button>
                </form>
                <form action={deleteInsight}>
                  <input type="hidden" name="id" value={insight.id} />
                  <ConfirmSubmit variant="danger" size="xs" confirmLabel="Delete for good">
                    Delete
                  </ConfirmSubmit>
                </form>
              </div>
              <p className="text-[11px] text-ink-faint leading-relaxed pt-1">
                Archiving keeps it and its evidence. Deleting removes only this insight — the
                conversations it came from are untouched.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
