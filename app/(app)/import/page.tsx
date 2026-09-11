import { Panel, PanelHeader } from "@/components/ui";
import { requireViewer } from "@/lib/auth/guard";
import { isAiConfigured } from "@/lib/parse/ai-config";
import { isDiscoverConfigured } from "@/lib/discover/config";
import { PageHeader } from "@/components/opportunity/bits";
import { ResearchImport } from "@/components/import/research-import";
import { CoreLoop } from "@/components/brand/core-loop";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireViewer();

  return (
    <div className="p-5 lg:p-6 max-w-[1240px]">
      <PageHeader
        title="Research Import"
        subtitle="Run Deep Research in Claude, paste what it gives you, turn it into opportunities."
        action={<CoreLoop active="find" className="hidden xl:block" size="sm" />}
      />

      <div className="grid xl:grid-cols-[minmax(0,2.15fr)_minmax(250px,0.85fr)] gap-4 items-start max-w-none">
        <ResearchImport aiConfigured={isAiConfigured()} discoverEnabled={isDiscoverConfigured()} />

        <Panel>
          <PanelHeader
            title="How this works"
            subtitle="Deep Research is not integrated — and pretending otherwise would just lose you data."
          />
          <ol className="px-4 py-3.5 flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-2.5">
                <span className="num text-[10.5px] text-ink-faint mt-[3px] shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium">{step.title}</p>
                  <p className="text-[11.5px] text-ink-faint mt-0.5 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="px-4 py-3 border-t border-line">
            <p className="text-[11.5px] text-ink-faint leading-relaxed">
              Deep Research lives in the Claude apps, not in this dashboard and not in Claude Code.
              The import screen is the seam between the two — so research quality stays yours to
              control, and nothing here depends on an API being available.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Run the research in Claude",
    body: "Use the copy button on the paste box to grab a prompt that produces a table this screen reads perfectly.",
  },
  {
    title: "Copy the whole answer",
    body: "Tables, JSON and plain headed notes are all understood. Don't bother cleaning it up first.",
  },
  {
    title: "Analyse & extract",
    body: "The built-in parser runs locally with no key. If GEMINI_API_KEY is set, AI extraction is offered as a second option for messy prose.",
  },
  {
    title: "Review every row",
    body: "Fix the company, title and category inline, and untick anything that is not worth a shot. Nothing is written until you import.",
  },
  {
    title: "Import",
    body: "Rows land in Sourced. Work them through the pipeline from there — the Workflow Finder is the next stop for anything you want to qualify.",
  },
];
