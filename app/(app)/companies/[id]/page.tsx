import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Trash2, Users } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getCompany } from "@/lib/queries/companies";
import { deleteCompany, deleteContact } from "@/lib/actions/companies";
import { formatTimestamp } from "@/lib/domain/dates";
import { CATEGORY_META } from "@/lib/domain/types";
import {
  Badge,
  EmptyState,
  ExternalLink,
  Panel,
  PanelHeader,
  SectionTitle,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui/client";
import {
  CategoryBadge,
  DeadlineCell,
  FollowUpCell,
  ScorePill,
  StageBadge,
} from "@/components/opportunity/bits";
import { ContactForm } from "@/components/opportunity/detail-forms";
import { CompanyForm } from "@/components/company/company-form";
import { hostOf, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, settings } = await requireViewer();
  const data = await getCompany(user.id, id, settings.scoringWeights);
  if (!data) notFound();

  const { company, opportunities, contacts, activities } = data;

  return (
    <div className="p-5 lg:p-6 max-w-[1240px]">
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint hover:text-ink transition-colors mb-3"
      >
        <ArrowLeft size={12} /> All companies
      </Link>

      <header className="flex items-start gap-3.5 mb-5">
        <span className="size-[42px] rounded-lg bg-raised text-[14px] font-semibold text-ink-muted grid place-items-center shrink-0">
          {initials(company.name)}
        </span>
        <div className="min-w-0">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] leading-tight">
            {company.name}
          </h1>
          <p className="text-[12.5px] text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
            {company.website ? (
              <ExternalLink href={company.website}>{hostOf(company.website)}</ExternalLink>
            ) : null}
            {company.industry ? <span>{company.industry}</span> : null}
            {company.size ? <span className="text-ink-faint">{company.size} employees</span> : null}
            {company.location ? <span className="text-ink-faint">{company.location}</span> : null}
            {company.linkedinUrl ? (
              <ExternalLink href={company.linkedinUrl}>LinkedIn</ExternalLink>
            ) : null}
          </p>
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <Panel>
            <PanelHeader
              title="Opportunities"
              subtitle={`${opportunities.length} at this company — a workflow pitch, a speculative shot and an open role can all coexist`}
            />
            {opportunities.length ? (
              <ul className="divide-y divide-line/60">
                {opportunities.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/opportunities/${row.id}`}
                      className="row-link flex items-center gap-3 px-4 py-3"
                    >
                      <CategoryBadge category={row.category} withLabel={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] truncate">{row.title}</p>
                        <p className="text-[10.5px] text-ink-faint mt-0.5">
                          {CATEGORY_META[row.category].short}
                          {row.location ? ` · ${row.location}` : ""}
                        </p>
                      </div>
                      <StageBadge stage={row.stage} short />
                      <div className="hidden sm:block w-[150px] shrink-0">
                        <FollowUpCell date={row.nextFollowUpAt} emptyLabel="—" />
                      </div>
                      <div className="hidden md:block w-[80px] shrink-0">
                        <DeadlineCell date={row.deadline} />
                      </div>
                      <div className="w-8 text-right shrink-0">
                        <ScorePill score={row.score} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No opportunities here yet"
                description="Add one with N and type this company's name — it will link automatically."
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Company profile" subtitle="Shared by every opportunity here" />
            <CompanyForm company={company} />
          </Panel>

          <Panel className="border-[#3a1b22]">
            <PanelHeader
              title="Delete company"
              subtitle="Its opportunities are kept and simply unlinked — nothing you have worked on is lost."
            />
            <div className="px-4 py-3">
              <form action={deleteCompany}>
                <input type="hidden" name="id" value={company.id} />
                <ConfirmSubmit confirmLabel="Click again to delete">
                  <span className="inline-flex items-center gap-1.5">
                    <Trash2 size={12} /> Delete company
                  </span>
                </ConfirmSubmit>
              </form>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <Panel>
            <PanelHeader
              icon={<Users size={13} className="text-ink-faint" />}
              title="Contacts"
              subtitle="Available on every opportunity at this company"
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
                      {contact.notes ? (
                        <p className="text-[11px] text-ink-faint mt-1">{contact.notes}</p>
                      ) : null}
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
              <EmptyState title="No contacts" description="Add the person who owns the decision." />
            )}
            <ContactForm companyId={company.id} />
          </Panel>

          <Panel>
            <PanelHeader title="Activity" subtitle="Across every opportunity here" />
            {activities.length ? (
              <ol className="px-4 py-3 flex flex-col gap-3">
                {activities.map((entry) => (
                  <li key={entry.activity.id} className="flex gap-2.5">
                    <span className="mt-[5px] size-[5px] rounded-full bg-line-strong shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] text-ink-muted leading-snug">
                        {entry.activity.message}
                      </p>
                      <p className="text-[10.5px] text-ink-faint mt-0.5 truncate">
                        {entry.opportunityTitle ? `${entry.opportunityTitle} · ` : ""}
                        {formatTimestamp(entry.activity.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nothing logged yet" />
            )}
          </Panel>

          {company.notes ? (
            <Panel className="px-4 py-3.5">
              <SectionTitle className="mb-2">Notes</SectionTitle>
              <p className="text-[12.5px] text-ink-muted whitespace-pre-wrap leading-relaxed">
                {company.notes}
              </p>
            </Panel>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).map((category) => {
              const count = opportunities.filter((row) => row.category === category).length;
              if (!count) return null;
              return (
                <Badge key={category} tone={category}>
                  {CATEGORY_META[category].icon} {count} {CATEGORY_META[category].short}
                </Badge>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
