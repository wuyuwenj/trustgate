import Link from "next/link";
import { getApiDetail } from "@/lib/api";

export const dynamic = "force-dynamic";

const defaultBackendBaseUrl = "http://127.0.0.1:3000";

interface ApiDetailPageProps {
  params: Promise<{
    apiId: string;
  }>;
}

function formatStarScore(score: number) {
  return `${score.toFixed(1)} / 5`;
}

function formatSuccessRate(successRate: number) {
  return `${Math.round(successRate * 100)}%`;
}

function formatReviewTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

export default async function ApiDetailPage({ params }: ApiDetailPageProps) {
  const { apiId } = await params;
  const decodedApiId = decodeURIComponent(apiId);
  const detail = await getApiDetail({
    apiId: decodedApiId,
    baseUrl: defaultBackendBaseUrl
  });
  const { api: profile } = detail;
  const aggregateStats = [
    {
      label: "Avg star score",
      value: formatStarScore(profile.avgStarScore),
      description: "Displayed rating from submitted integer reviews."
    },
    {
      label: "Review count",
      value: String(profile.reviewCount),
      description: "Each review represents one real API call outcome."
    },
    {
      label: "Success rate",
      value: formatSuccessRate(profile.successRate),
      description: "Share of submitted calls marked successful."
    },
    {
      label: "Median latency",
      value: `${profile.medianLatencyMs} ms`,
      description: "Telemetry stays supporting evidence beside the rating."
    },
    {
      label: "Rate-limited calls",
      value: String(profile.rateLimitedCount),
      description: "Count of reports that flagged rate limiting."
    }
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="w-full space-y-6">
        <section className="card overflow-hidden px-8 py-10 lg:px-10 lg:py-12">
          <div className="badge w-fit bg-white/[0.03] text-cyan-200">
            API trust profile
          </div>
          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <div className="space-y-5">
              <div>
                <p className="panel-title">Provider</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                  {profile.provider}
                </h1>
              </div>
              <div>
                <p className="panel-title">Endpoint</p>
                <p className="mt-2 break-all text-base leading-7 text-slate-300">
                  {profile.endpoint}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                This page summarizes the public Trustgate profile for one API
                identity, defined as provider plus endpoint. Ratings come from
                required star scores, while latency and rate-limit signals remain
                supporting evidence.
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-xs font-medium text-slate-300">
                <span className="badge bg-white/[0.02] text-slate-200">
                  {profile.category}
                </span>
                <span className="badge bg-white/[0.02] text-slate-200">
                  {profile.apiId}
                </span>
              </div>
            </div>

            <aside className="card-soft glow-ring px-6 py-6">
              <p className="panel-title">Profile summary</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Displayed rating</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
                    {formatStarScore(profile.avgStarScore)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Reviews submitted
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {profile.reviewCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Successful calls
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {formatSuccessRate(profile.successRate)}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {aggregateStats.map((stat) => (
            <article key={stat.label} className="card-soft h-full px-6 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {stat.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {stat.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {stat.description}
              </p>
            </article>
          ))}
        </section>

        <section className="card-soft flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="panel-title">Recent reviews</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Individual reports stay visible beside the aggregate score so
              humans can inspect the underlying call outcomes.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
          >
            Back to rankings
          </Link>
        </section>

        <section className="grid gap-4">
          {detail.reviews.map((review, index) => (
            <article key={`${review.timestamp}-${index}`} className="card-soft px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {review.starScore} / 5 stars
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {review.taskType}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                  <span
                    className={`badge border-0 ${
                      review.success
                        ? "bg-emerald-400/15 text-emerald-200"
                        : "bg-rose-400/15 text-rose-200"
                    }`}
                  >
                    {review.success ? "Success" : "Failure"}
                  </span>
                  <span className="badge bg-white/[0.02] text-slate-300">
                    {formatReviewTimestamp(review.timestamp)}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Latency
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {review.latencyMs} ms
                  </p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Rate limited
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {review.rateLimited ? "Yes" : "No"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-black/20 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Review category
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {review.category}
                  </p>
                </div>
              </div>

              {review.agentName || review.sourceType ? (
                <div className="mt-5 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Provenance
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.agentName ? (
                      <span className="badge bg-white/[0.03] text-slate-200">
                        Agent: {review.agentName}
                      </span>
                    ) : null}
                    {review.sourceType ? (
                      <span className="badge bg-white/[0.03] text-slate-200">
                        Source: {review.sourceType}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {review.comment ? (
                <p className="mt-5 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-slate-300">
                  {review.comment}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
