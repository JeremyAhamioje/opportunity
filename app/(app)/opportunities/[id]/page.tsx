import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ExternalLink as ExternalIcon,
  FileText,
  Hammer,
  Link2,
  Mail,
  Phone,
  Trash2,
  Users,
} from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getOpportunity } from "@/lib/queries/opportunities";
import {
  addNote,
  deleteOpportunity,
  setStageFromForm,
  updateDocuments,
} from "@/lib/actions/opportunities";
import { deleteContact } from "@/lib/actions/companies";
import { deleteAction, toggleAction } from "@/lib/actions/tasks";
import { logBuildCheckIn } from "@/lib/actions/builds";
import {
  ACTION_TYPE_META,
  BUILD_LANES,
  buildLaneOf,
  SENTIMENT_META,
  stageLabel,
  STAGES,
} from "@/lib/domain/types";
import { formatDay, formatLongDay, formatTimestamp, urgencyOf } from "@/lib/domain/dates";
import {
  Badge,
  EmptyState,
  ExternalLink,
  Input,
  Panel,
  PanelHeader,
  Select,
  buttonClass,
  URGENCY_TEXT,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import {
  CategoryBadge,
  DeadlineCell,
  MockBadge,
  OpportunityImage,
  OriginStrip,
  ScorePill,
  StageBadge,
} from "@/components/opportunity/bits";
import { OutreachPanel } from "@/components/opportunity/outreach-panel";
import { ScoreEditor } from "@/components/opportunity/score-editor";
import { EditForm } from "@/components/opportunity/edit-form";
import { SopRunner } from "@/components/opportunity/sop-runner";
import { ActionForm, ContactForm, ResponseForm } from "@/components/opportunity/detail-forms";
import { cn, hostOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, settings } = await requireViewer();
  const data = await getOpportunity(user.id, id, settings.scoringWeights);
  if (!data) notFound();

  const { opportunity: row, company, actions, responses, activities, contacts } = data;
  const stageIndex = STAGES.indexOf(row.stage);
  const nextStage = stageIndex >= 0 && stageIndex < 7 ? STAGES[stageIndex + 1] : null;
  const openActions = actions.filter((action) => action.status !== "done");
  const doneActions = actions.filter((action) => action.status === "done");

  return (
    <div className="p-5 lg:p-6 max-w-[1360px]">
      <Link
        href="/opportunities"
        className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint hover:text-ink transition-colors mb-3"
      >
        <ArrowLeft size={12} /> All opportunities
      </Link>

      {/* ---- Header ---- */}
      <div className="relative rounded-[10px] overflow-hidden border border-line mb-4">
        <OpportunityImage src={row.image} alt="" height={132} />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <CategoryBadge category={row.category} />
            <StageBadge stage={row.stage} category={row.category} />
            {row.isMock ? <MockBadge /> : null}
            {row.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] leading-tight">
            {row.title}
          </h1>
          <p className="text-[12.5px] text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
            {row.companyId ? (
              <Link
                href={`/companies/${row.companyId}`}
                className="inline-flex items-center gap-1.5 hover:text-accent-hot transition-colors"
              >
                <Building2 size={12} />
                {row.companyName}
              </Link>
            ) : (
              <span className="text-ink-faint">No company linked</span>
            )}
            {company?.industry ? <span className="text-ink-faint">· {company.industry}</span> : null}
            {company?.size ? <span className="text-ink-faint">· {company.size}</span> : null}
          </p>
          <OriginStrip
            className="mt-1.5"
            location={row.location ?? company?.location}
            country={row.country}
            website={row.companyWebsite ?? row.applicationUrl}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <form action={setStageFromForm} className="flex items-center gap-1.5">
            <input type="hidden" name="id" value={row.id} />
            <Select
              name="stage"
              defaultValue={row.category === "build" ? buildLaneOf(row.stage) : row.stage}
              className="h-[30px] py-0 w-auto"
            >
              {(row.category === "build" ? BUILD_LANES : STAGES).map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabel(stage, row.category)}
                </option>
              ))}
            </Select>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Set stage
            </button>
          </form>

          {nextStage ? (
            <form action={setStageFromForm}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="stage" value={nextStage} />
              <button type="submit" className={buttonClass("primary", "sm")}>
                {stageLabel(nextStage, row.category, true)} <ArrowRight size={12} />
              </button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* ---- Outreach ---- */}
          {/* A build has nobody to chase, so the outreach and response panels
              are replaced by the one thing that keeps it alive: a check-in that
              records where it got to and schedules the next look. */}
          {row.category === "build" ? (
            <Panel>
              <PanelHeader
                icon={<Hammer size={13} className="text-cat-build" />}
                title="Check-in"
                subtitle={
                  row.nextFollowUpAt
                    ? `Next nudge ${formatLongDay(row.nextFollowUpAt)}. Log where it actually got to, or push it out.`
                    : "No check-in scheduled — this build will not come back on its own."
                }
              />
              <form action={logBuildCheckIn} className="px-4 py-3.5 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={row.id} />
                <div className="flex-1 min-w-[200px]">
                  <label
                    htmlFor="progress"
                    className="block text-[11.5px] text-ink-muted mb-1.5"
                  >
                    What happened since last time?
                  </label>
                  <Input
                    id="progress"
                    name="progress"
                    placeholder="Sketched the questionnaire — 6 questions"
                  />
                </div>
                <div className="w-[110px]">
                  <label
                    htmlFor="checkInDays"
                    className="block text-[11.5px] text-ink-muted mb-1.5"
                  >
                    Next in (days)
                  </label>
                  <Input
                    id="checkInDays"
                    name="checkInDays"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={7}
                  />
                </div>
                <button type="submit" className={buttonClass("primary", "sm")}>
                  <Check size={12} /> Log check-in
                </button>
              </form>
              {row.followUpCount > 0 ? (
                <p className="px-4 pb-3.5 -mt-1 text-[11.5px] text-ink-faint">
                  {row.followUpCount} check-in{row.followUpCount === 1 ? "" : "s"} logged
                  {row.lastActionLabel ? ` · last: ${row.lastActionLabel}` : ""}
                </p>
              ) : null}
            </Panel>
          ) : (
            <Panel>
              <PanelHeader
                icon={<Mail size={13} className="text-accent" />}
                title="Outreach & follow-up"
                subtitle="You send it. This remembers when to chase."
              />
              <OutreachPanel row={row} defaultFollowUpDays={settings.followUpDefaultDays} />
            </Panel>
          )}

          {/* ---- Responses ---- */}
          {row.category !== "build" ? (
          <Panel>
            <PanelHeader
              title="Responses"
              subtitle="Log every reply, including rejections — that is what makes the analytics honest."
            />
            {responses.length ? (
              <ul className="divide-y divide-line/60">
                {responses.map((response) => (
                  <li key={response.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        tone={
                          response.sentiment === "positive"
                            ? "good"
                            : response.sentiment === "negative"
                              ? "bad"
                              : "warn"
                        }
                      >
                        {SENTIMENT_META[response.sentiment].label}
                      </Badge>
                      <span className="num text-[11px] text-ink-faint">
                        {formatLongDay(response.receivedAt)}
                      </span>
                      {response.channel ? (
                        <span className="text-[11px] text-ink-faint">· {response.channel}</span>
                      ) : null}
                    </div>
                    <p className="text-[12.5px] text-ink-muted whitespace-pre-wrap leading-relaxed">
                      {response.summary}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No responses yet"
                description="When they reply, record it here — the reply resolves the follow-up automatically."
              />
            )}
            <ResponseForm id={row.id} />
          </Panel>
          ) : null}

          {/* ---- Actions ---- */}
          <Panel>
            <PanelHeader
              icon={<Check size={13} className="text-ink-faint" />}
              title="Actions"
              subtitle={
                openActions.length
                  ? `${openActions.length} open · ${doneActions.length} done`
                  : "Apply, email, call, build a demo — whatever moves this forward"
              }
            />
            {actions.length ? (
              <ul className="divide-y divide-line/60">
                {actions.map((action) => {
                  const done = action.status === "done";
                  const urgency = urgencyOf(action.dueDate);
                  return (
                    <li key={action.id} className="flex items-center gap-3 px-4 py-2.5">
                      <form action={toggleAction} className="flex">
                        <input type="hidden" name="id" value={action.id} />
                        <button
                          type="submit"
                          title={done ? "Mark not done" : "Mark done"}
                          className={cn(
                            "size-[15px] rounded-[3px] border grid place-items-center transition-colors",
                            done
                              ? "bg-good/20 border-good/60 text-good"
                              : "border-line-strong hover:border-[#44444f]",
                          )}
                        >
                          {done ? <Check size={10} strokeWidth={3} /> : null}
                        </button>
                      </form>

                      <span className="text-[11px] text-ink-faint w-4 shrink-0" aria-hidden>
                        {ACTION_TYPE_META[action.type].icon}
                      </span>

                      <span
                        className={cn(
                          "text-[12.5px] flex-1 min-w-0 truncate",
                          done && "text-ink-faint line-through decoration-line-strong",
                        )}
                      >
                        {action.title}
                      </span>

                      <span className={cn("num text-[11px] shrink-0", done ? "text-ink-faint" : URGENCY_TEXT[urgency])}>
                        {done
                          ? action.completedDate
                            ? `done ${formatDay(action.completedDate)}`
                            : "done"
                          : formatDay(action.dueDate)}
                      </span>

                      <form action={deleteAction} className="flex shrink-0">
                        <input type="hidden" name="id" value={action.id} />
                        <button
                          type="submit"
                          aria-label="Delete action"
                          className="text-ink-faint hover:text-bad transition-colors p-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="No actions yet"
                description="Break the next move into something you can tick off."
              />
            )}
            <ActionForm opportunityId={row.id} />
          </Panel>

          {/* ---- Scholarship documents ---- */}
          {row.category === "scholarship" ? (
            <Panel>
              <PanelHeader
                icon={<FileText size={13} className="text-cat-scholarship" />}
                title="Documents required"
                subtitle={`${row.documents.filter((doc) => doc.done).length} of ${row.documents.length} complete`}
              />
              <form action={updateDocuments} className="px-4 py-3.5">
                <input type="hidden" name="id" value={row.id} />
                {row.documents.length ? (
                  <ul className="flex flex-col gap-1.5 mb-3">
                    {row.documents.map((doc, index) => (
                      <li key={`${doc.name}-${index}`}>
                        <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
                          <input
                            type="checkbox"
                            name={`doc_${index}`}
                            defaultChecked={doc.done}
                            className="size-[14px] accent-[var(--color-good)]"
                          />
                          <span className={doc.done ? "text-ink-faint line-through" : ""}>
                            {doc.name}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-ink-faint mb-3">
                    Nothing listed yet. Add the first document below.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <Input name="newDocument" placeholder="Add a required document…" />
                  <button type="submit" className={buttonClass("secondary", "sm")}>
                    Save
                  </button>
                </div>
              </form>
            </Panel>
          ) : null}

          {/* ---- The original dump ---- */}
          {row.category === "build" && row.brainDump ? (
            <Panel>
              <PanelHeader
                icon={<Hammer size={13} className="text-cat-build" />}
                title="Original dump"
                subtitle="Exactly as typed. The structured fields above are an interpretation of this — when they drift, this is the record."
              />
              <p className="px-4 py-3.5 text-[12.5px] text-ink-muted whitespace-pre-wrap leading-relaxed">
                {row.brainDump}
              </p>
            </Panel>
          ) : null}

          {/* ---- Score ---- */}
          {/* The seven factors measure a workflow pitch's worth to a buyer, so
              they mean nothing for something you are building yourself. */}
          {row.category !== "build" ? (
          <Panel>
            <PanelHeader
              title="Opportunity score"
              subtitle="Weighted 0–100. Drag to score; the total updates live."
            />
            <ScoreEditor
              id={row.id}
              weights={settings.scoringWeights}
              dataAccessible={row.dataAccessible}
              initial={{
                repetition: row.scoreRepetition,
                frequency: row.scoreFrequency,
                pain: row.scorePain,
                automability: row.scoreAutomability,
                financialValue: row.scoreFinancialValue,
                decisionMaker: row.scoreDecisionMaker,
                capability: row.scoreCapability,
              }}
            />
          </Panel>
          ) : null}

          {/* ---- Details ---- */}
          <Panel>
            <PanelHeader title="Details" subtitle="Everything you know about this opportunity" />
            <EditForm row={row} />
          </Panel>

          {/* ---- SOP ---- */}
          {/* Last on the page on purpose: it is by far the tallest panel, and
              once an opportunity is qualified it is consulted far less often
              than the fields above it. */}
          {row.category === "workflow" ? (
            <Panel>
              <PanelHeader
                icon={<span aria-hidden>🔍</span>}
                title="Workflow Opportunity Finder"
                subtitle="Work the SOP against this company. Ticks are saved per opportunity."
                action={
                  <Link href="/finder" className={buttonClass("ghost", "xs")}>
                    Edit checklist
                  </Link>
                }
              />
              <SopRunner
                opportunityId={row.id}
                checklist={settings.sopChecklist}
                progress={row.sopProgress}
              />
            </Panel>
          ) : null}
        </div>

        {/* ---------------------------- Sidebar ---------------------------- */}
        <div className="flex flex-col gap-4 min-w-0">
          <Panel>
            <PanelHeader title="At a glance" />
            <dl className="px-4 py-3 grid grid-cols-2 gap-y-3 gap-x-3">
              <Fact label="Score">
                <ScorePill score={row.score} size="lg" />
              </Fact>
              <Fact label="Deadline">
                <DeadlineCell date={row.deadline} />
              </Fact>
              <Fact label="Added">
                <span className="num text-[12px]">{formatDay(row.createdAt.toISOString().slice(0, 10))}</span>
              </Fact>
              <Fact label="Sent">
                <span className="num text-[12px]">{row.sentAt ? formatDay(row.sentAt) : "—"}</span>
              </Fact>
              {row.category === "job" ? (
                <>
                  <Fact label="Salary">
                    <span className="text-[12px]">{row.salary ?? "—"}</span>
                  </Fact>
                  <Fact label="Work mode">
                    <span className="text-[12px] capitalize">{row.workMode ?? "—"}</span>
                  </Fact>
                </>
              ) : null}
              {row.category === "scholarship" ? (
                <>
                  <Fact label="Funding">
                    <span className="text-[12px]">{row.fundingAmount ?? "—"}</span>
                  </Fact>
                  <Fact label="Level">
                    <span className="text-[12px]">{row.degreeLevel ?? "—"}</span>
                  </Fact>
                </>
              ) : null}
              {row.category === "workflow" ? (
                <Fact label="Decision maker" wide>
                  <span className="text-[12px]">{row.buyerRole ?? "Not identified"}</span>
                </Fact>
              ) : null}
            </dl>
            {row.skills.length ? (
              <div className="px-4 pb-3 flex flex-wrap gap-1">
                {row.skills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            ) : null}
          </Panel>

          {/* ---- Links (brief §11) ---- */}
          <Panel>
            <PanelHeader
              icon={<Link2 size={13} className="text-ink-faint" />}
              title="Links"
              subtitle="Never lose where you found it"
            />
            <ul className="px-4 py-3 flex flex-col gap-2">
              <LinkRow label="Application" href={row.applicationUrl} />
              <LinkRow label="Company site" href={row.companyWebsite} />
              <LinkRow label="LinkedIn" href={company?.linkedinUrl ?? null} />
              <LinkRow label="Contact" href={row.contactUrl} />
              <LinkRow label="Documents" href={row.documentsUrl} />
            </ul>
          </Panel>

          {/* ---- Contacts ---- */}
          <Panel>
            <PanelHeader
              icon={<Users size={13} className="text-ink-faint" />}
              title="Contacts"
              subtitle="Who actually owns the decision"
            />
            {contacts.length ? (
              <ul className="divide-y divide-line/60">
                {contacts.map((contact) => (
                  <li key={contact.id} className="px-4 py-2.5 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px]">{contact.name}</p>
                      {contact.role ? (
                        <p className="text-[11px] text-ink-faint">{contact.role}</p>
                      ) : null}
                      <div className="flex flex-col gap-0.5 mt-1">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-[11.5px] text-accent hover:underline inline-flex items-center gap-1.5"
                          >
                            <Mail size={10} /> {contact.email}
                          </a>
                        ) : null}
                        {contact.linkedinUrl ? (
                          <ExternalLink href={contact.linkedinUrl} className="text-[11.5px]">
                            LinkedIn
                          </ExternalLink>
                        ) : null}
                        {contact.phone ? (
                          <span className="text-[11.5px] text-ink-muted inline-flex items-center gap-1.5">
                            <Phone size={10} /> {contact.phone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <form action={deleteContact}>
                      <input type="hidden" name="id" value={contact.id} />
                      <button
                        type="submit"
                        aria-label="Remove contact"
                        className="text-ink-faint hover:text-bad transition-colors p-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No contacts" description="Add the person who owns the budget." />
            )}
            <ContactForm companyId={row.companyId} opportunityId={row.id} />
          </Panel>

          {/* ---- Timeline (brief §8) ---- */}
          <Panel>
            <PanelHeader title="Activity timeline" subtitle="Everything that has happened here" />
            <form action={addNote} className="px-4 py-2.5 border-b border-line flex gap-2">
              <input type="hidden" name="id" value={row.id} />
              <Input name="message" placeholder="Log a note…" className="h-[28px] py-0" />
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Log
              </button>
            </form>
            {activities.length ? (
              <ol className="px-4 py-3 flex flex-col gap-3">
                {activities.map((entry) => (
                  <li key={entry.id} className="flex gap-2.5">
                    <span className="mt-[5px] size-[5px] rounded-full bg-line-strong shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] text-ink-muted leading-snug">{entry.message}</p>
                      <p className="text-[10.5px] text-ink-faint mt-0.5">
                        {formatTimestamp(entry.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nothing logged yet" />
            )}
          </Panel>

          {/* ---- Delete ---- */}
          <Panel className="border-[#3a1b22]">
            <PanelHeader
              title="Delete opportunity"
              subtitle="Removes it, its actions, responses and timeline. Cannot be undone."
            />
            <div className="px-4 py-3">
              <form action={deleteOpportunity}>
                <input type="hidden" name="id" value={row.id} />
                <ConfirmSubmit confirmLabel="Click again to delete permanently">
                  <span className="inline-flex items-center gap-1.5">
                    <Trash2 size={12} /> Delete
                  </span>
                </ConfirmSubmit>
              </form>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function LinkRow({ label, href }: { label: string; href: string | null }) {
  return (
    <li className="flex items-baseline gap-2 text-[12px]">
      <span className="text-ink-faint w-[92px] shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-hot hover:underline truncate inline-flex items-center gap-1 min-w-0"
        >
          <span className="truncate">{hostOf(href) ?? href}</span>
          <ExternalIcon size={10} className="shrink-0" />
        </a>
      ) : (
        <span className="text-ink-faint">—</span>
      )}
    </li>
  );
}
