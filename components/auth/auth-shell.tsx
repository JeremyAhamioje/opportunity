import type { ReactNode } from "react";
import { Crosshair } from "lucide-react";
import { CoreLoop } from "@/components/brand/core-loop";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.05fr_minmax(380px,0.95fr)]">
      {/* Statement half — what this thing is for. */}
      <section className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-[linear-gradient(150deg,#0d0b1a_0%,#08080a_55%)]">
        <div className="flex items-center gap-2">
          <Crosshair size={17} className="text-accent" />
          <span className="text-[12.5px] font-semibold tracking-tight">
            Opportunity Command Center
          </span>
        </div>

        <div className="max-w-lg">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em]">
            Shoot as many
            <br />
            high-quality shots
            <br />
            <span className="text-accent">as humanly possible.</span>
          </h1>
          <p className="text-[13.5px] text-ink-muted mt-5 leading-relaxed">
            Not a job tracker. A pipeline for workflow pitches, speculative shots, live
            roles and scholarships — built so nothing is ever lost to a forgotten
            follow-up.
          </p>
          <CoreLoop className="mt-8" />
        </div>

        <p className="text-[11px] text-ink-faint">
          Find → Qualify → Take the shot → Track → Follow up → Measure → Repeat
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[340px] mx-auto">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Crosshair size={17} className="text-accent" />
            <span className="text-[12.5px] font-semibold tracking-tight">
              Opportunity Command Center
            </span>
          </div>

          <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
          <p className="text-[12.5px] text-ink-muted mt-1 mb-6 leading-relaxed">{subtitle}</p>

          {children}

          {footer ? <div className="mt-6 text-[11.5px] text-ink-faint">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
