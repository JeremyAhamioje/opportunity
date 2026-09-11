import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { listCompanies } from "@/lib/queries/companies";
import { EmptyState, Input, Panel, buttonClass } from "@/components/ui";
import { FollowUpCell, PageHeader } from "@/components/opportunity/bits";
import { hostOf, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await requireViewer();
  const { q } = await searchParams;
  const rows = await listCompanies(user.id, q);

  return (
    <div className="p-5 lg:p-6 max-w-[1200px]">
      <PageHeader
        title="Companies"
        subtitle="One record per organisation. A company can hold a workflow pitch, a speculative shot and an open role at the same time."
      />

      <form className="flex items-center gap-2 mb-3" action="/companies">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search companies, industries, locations…"
          className="h-[30px] py-0 max-w-[340px]"
        />
        <button type="submit" className={buttonClass("secondary", "sm")}>
          Search
        </button>
        {q ? (
          <Link href="/companies" className="text-[11.5px] text-ink-faint hover:text-ink">
            Clear
          </Link>
        ) : null}
        <span className="num text-[11.5px] text-ink-faint ml-auto">
          {rows.length} {rows.length === 1 ? "company" : "companies"}
        </span>
      </form>

      {rows.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {rows.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="bg-surface border border-line rounded-[10px] p-3.5 hover:border-line-strong transition-colors flex flex-col gap-2.5"
            >
              <div className="flex items-start gap-2.5">
                <span className="size-[30px] rounded-md bg-raised text-[11px] font-semibold text-ink-muted grid place-items-center shrink-0">
                  {initials(company.name) || <Building2 size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{company.name}</p>
                  <p className="text-[11px] text-ink-faint truncate">
                    {[company.industry, company.size, company.location]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11.5px] text-ink-muted">
                <span>
                  <span className="num font-semibold text-ink">{company.openCount}</span> open
                </span>
                <span className="text-ink-faint">
                  <span className="num">{company.opportunityCount}</span> total
                </span>
                {company.contactCount > 0 ? (
                  <span className="text-ink-faint">
                    <span className="num">{company.contactCount}</span>{" "}
                    {company.contactCount === 1 ? "contact" : "contacts"}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/70">
                <FollowUpCell date={company.nextFollowUpAt} emptyLabel="No follow-up scheduled" />
                {company.website ? (
                  <span className="text-[11px] text-ink-faint truncate max-w-[40%]">
                    {hostOf(company.website)}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={q ? `No companies match “${q}”` : "No companies yet"}
            description="Companies are created automatically when you add an opportunity — just type the name."
          />
        </Panel>
      )}
    </div>
  );
}
