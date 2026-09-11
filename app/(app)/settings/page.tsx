import { headers } from "next/headers";
import { Mail, Puzzle } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { CaptureTokenForm } from "@/components/settings/capture-form";
import { databaseLabel } from "@/lib/db";
import { aiModelId, isAiConfigured } from "@/lib/parse/ai-config";
import { emailFrom, isEmailConfigured, usingSharedSender } from "@/lib/email/resend";
import { NotificationForm } from "@/components/settings/notification-form";
import { Badge, Panel, PanelHeader, KeyHint } from "@/components/ui";
import { PageHeader } from "@/components/opportunity/bits";
import {
  FollowUpForm,
  GoalsForm,
  GoalsReset,
  PasswordForm,
  ProfileForm,
  WeightsForm,
} from "@/components/settings/settings-forms";

export const dynamic = "force-dynamic";

const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl K", "Command palette — search everything, jump anywhere"],
  ["N", "Add an opportunity"],
  ["G then D", "Dashboard"],
  ["G then T", "Today's Shots"],
  ["G then P", "Pipeline"],
  ["G then O", "Opportunities"],
  ["G then C", "Companies"],
  ["G then B", "Builds"],
  ["G then E", "Ideas"],
  ["G then Y", "You said you would"],
  ["G then V", "Conversations"],
  ["G then I", "Research Import"],
  ["G then F", "Workflow Finder"],
  ["G then A", "Analytics"],
  ["Esc", "Close a dialog"],
];

/**
 * Where this instance is reachable, so the extension can be pointed at it
 * without the user guessing a port. Read from the request rather than hardcoded
 * because it differs between localhost and a deployment.
 */
async function currentOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function SettingsPage() {
  const { user, settings } = await requireViewer();

  return (
    <div className="p-5 lg:p-6 max-w-[1080px]">
      <PageHeader
        title="Settings"
        subtitle="Tune the parts of the system that encode your judgement — targets, weights, and cadence."
      />

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Panel id="goals" className="xl:col-span-2 scroll-mt-16">
          <PanelHeader
            title="Daily goals"
            subtitle="Shown on Today's Shots. Progress is counted from real activity, so a goal cannot be ticked without doing the work."
            action={<GoalsReset />}
          />
          <GoalsForm goals={settings.dailyGoals} />
        </Panel>

        <Panel id="weights" className="scroll-mt-16">
          <PanelHeader
            title="Opportunity score weights"
            subtitle="How much each factor counts towards the 0–100 score. Zero removes a factor entirely."
          />
          <WeightsForm weights={settings.scoringWeights} />
        </Panel>

        <Panel>
          <PanelHeader
            title="Follow-up cadence"
            subtitle="The default gap between sending and the next nudge"
          />
          <FollowUpForm days={settings.followUpDefaultDays} />
        </Panel>

        <Panel id="notifications" className="scroll-mt-16">
          <PanelHeader
            icon={<Mail size={13} className="text-accent" />}
            title="Email reminders"
            subtitle="The one thing the app cannot do while it is closed"
          />
          <NotificationForm
            config={settings}
            accountEmail={user.email}
            configured={isEmailConfigured()}
            sharedSender={usingSharedSender()}
          />
        </Panel>

        <Panel id="capture" className="scroll-mt-16">
          <PanelHeader
            icon={<Puzzle size={13} className="text-accent" />}
            title="Browser capture"
            subtitle="The token the extension uses to send conversations here"
          />
          <CaptureTokenForm
            hint={settings.ingestTokenHint}
            createdAt={settings.ingestTokenCreatedAt}
            origin={await currentOrigin()}
          />
        </Panel>

        <Panel>
          <PanelHeader title="Account" subtitle="Who owns this command center" />
          <ProfileForm user={user} />
        </Panel>

        <Panel>
          <PanelHeader title="Password" subtitle="Changing it does not sign you out elsewhere" />
          <PasswordForm />
        </Panel>

        <Panel>
          <PanelHeader title="Keyboard shortcuts" subtitle="Speed is the whole point" />
          <ul className="px-4 py-3 flex flex-col gap-1.5">
            {SHORTCUTS.map(([keys, description]) => (
              <li key={keys} className="flex items-center gap-3 text-[12px]">
                <span className="w-[104px] shrink-0">
                  <KeyHint>{keys}</KeyHint>
                </span>
                <span className="text-ink-muted">{description}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="System" subtitle="What this instance is running on" />
          <dl className="px-4 py-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12px] text-ink-muted">Database</dt>
              <dd className="text-[12px]">
                <Badge tone="neutral">{databaseLabel()}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12px] text-ink-muted">AI extraction</dt>
              <dd className="text-[12px]">
                <Badge tone={isAiConfigured() ? "good" : "neutral"}>
                  {isAiConfigured() ? aiModelId() : "Not configured"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[12px] text-ink-muted">Email</dt>
              <dd className="text-[12px] min-w-0">
                <Badge tone={isEmailConfigured() ? "good" : "neutral"}>
                  {isEmailConfigured() ? emailFrom() : "Not configured"}
                </Badge>
              </dd>
            </div>
            <p className="text-[11px] text-ink-faint leading-relaxed pt-1.5 border-t border-line/70">
              Research Import works without AI — the built-in parser needs no key and no network.
              Setting <code className="text-ink-muted">GEMINI_API_KEY</code> only adds a second
              extraction option for messy prose, and{" "}
              <code className="text-ink-muted">GEMINI_MODEL_ID</code> chooses the model. Point{" "}
              <code className="text-ink-muted">DATABASE_URL</code> at a Postgres server to move off
              the local database; the schema is identical.
            </p>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
