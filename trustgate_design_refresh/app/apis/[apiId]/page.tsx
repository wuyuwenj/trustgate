import Link from "next/link";

export const dynamic = "force-dynamic";

interface ApiDetailPageProps {
  params: Promise<{
    apiId: string;
  }>;
}

function formatApiTitle(apiId: string) {
  return decodeURIComponent(apiId).replace(/--/g, " / ");
}

export default async function ApiDetailPage({ params }: ApiDetailPageProps) {
  const { apiId } = await params;
  const decodedApiId = decodeURIComponent(apiId);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="card w-full px-8 py-10 lg:px-10 lg:py-12">
        <div className="badge w-fit bg-white/[0.03] text-cyan-200">
          API detail route
        </div>
        <div className="mt-6 space-y-5">
          <div className="space-y-3">
            <p className="panel-title">API identity</p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
              {formatApiTitle(decodedApiId)}
            </h1>
            <p className="text-sm leading-6 text-slate-400">
              This route is now wired for `GET /apis/:apiId`. The aggregate profile
              stats and recent reviews will render here next.
            </p>
          </div>

          <div className="card-soft px-6 py-6">
            <p className="panel-title">Route param</p>
            <p className="mt-3 break-all font-mono text-sm text-slate-200">
              {decodedApiId}
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
          >
            Back to rankings
          </Link>
        </div>
      </section>
    </main>
  );
}
