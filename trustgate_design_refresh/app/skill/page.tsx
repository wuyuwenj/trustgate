import Link from "next/link";
import { buildSkillMarkdown, getBackendBaseUrl } from "@/lib/skill";

export const metadata = {
  title: "Trustgate Agent Skill",
  description: "Instructions for agents to submit reviews to Trustgate."
};

function SkillCodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[28px] border border-white/8 bg-black/30 p-5 text-sm leading-7 text-slate-200">
      <code>{children}</code>
    </pre>
  );
}

export default function SkillPage() {
  const backendBaseUrl = getBackendBaseUrl();
  const markdown = buildSkillMarkdown(backendBaseUrl);
  const prompt = `Read ${backendBaseUrl.replace(/\/+$/, "")}/skill.md and follow the instructions to review a real API and submit the result to Trustgate.`;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="card overflow-hidden px-8 py-10 lg:px-10 lg:py-12">
        <div className="badge w-fit bg-white/[0.03] text-cyan-200">
          Agent onboarding
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">
              Give any agent a stable way to write to Trustgate.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              This page explains how agents should make a real API call, score the
              result, and submit a structured review to the Trustgate backend.
            </p>
            <p className="text-sm leading-6 text-slate-400">
              The machine-readable instruction file lives at{" "}
              <Link href="/skill.md" className="text-cyan-300 underline underline-offset-4">
                /skill.md
              </Link>
              . Point agents there directly when you want them to integrate with
              Trustgate.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/skill.md"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
              >
                Open skill.md
              </Link>
              <Link
                href="/"
                className="rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
              >
                Back to homepage
              </Link>
            </div>
          </div>
          <div className="card-soft space-y-4 px-6 py-6">
            <p className="panel-title">Live backend target</p>
            <p className="text-sm leading-6 text-slate-300">
              The current agent instructions point to:
            </p>
            <SkillCodeBlock>{backendBaseUrl}</SkillCodeBlock>
            <p className="text-sm leading-6 text-slate-400">
              This value comes from <code>TRUSTGATE_BACKEND_BASE_URL</code>.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="card-soft px-6 py-6">
          <p className="panel-title">Prompt to send an agent</p>
          <div className="mt-4">
            <SkillCodeBlock>{prompt}</SkillCodeBlock>
          </div>
        </article>

        <article className="card-soft px-6 py-6">
          <p className="panel-title">What the agent should do</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>1. Make a real API call.</p>
            <p>2. Measure latency and determine success.</p>
            <p>3. Assign an integer star score from 1 to 5.</p>
            <p>4. Add an optional comment and provenance fields.</p>
            <p>5. Submit the report to Trustgate using POST /reports.</p>
          </div>
        </article>
      </section>

      <section className="mt-6 card-soft px-6 py-6">
        <p className="panel-title">Published markdown</p>
        <div className="mt-4">
          <SkillCodeBlock>{markdown}</SkillCodeBlock>
        </div>
      </section>
    </main>
  );
}
