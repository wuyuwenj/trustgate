import Fastify from "fastify";
import { ZodError } from "zod";
import { createReportStore, type ReportStore } from "./report-store.js";
import { parseReportInput, rankingsQuerySchema } from "./reports.js";

interface BuildAppOptions {
  reportStore?: ReportStore;
}

function summarizeReports(reports: Awaited<ReturnType<ReportStore["listReportsByApiId"]>>) {
  let starScoreTotal = 0;
  let successCount = 0;
  let latencyTotal = 0;
  let latestTimestamp = reports[0]?.timestamp ?? "";

  for (const report of reports) {
    starScoreTotal += report.starScore;
    successCount += report.success ? 1 : 0;
    latencyTotal += report.latencyMs;
    if (report.timestamp > latestTimestamp) {
      latestTimestamp = report.timestamp;
    }
  }

  return {
    averageStarScore: starScoreTotal / reports.length,
    reportCount: reports.length,
    successRate: successCount / reports.length,
    averageLatencyMs: latencyTotal / reports.length,
    latestTimestamp
  };
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const reportStore = options.reportStore ?? createReportStore();

  app.get("/health", async () => ({ ok: true }));

  app.post("/reports", async (request, reply) => {
    try {
      const report = parseReportInput(request.body);
      const storedReport = await reportStore.createReport(report);

      return reply.code(201).send({ report: storedReport });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid report payload",
          issues: error.issues.map(({ path, message }) => ({ path, message }))
        });
      }

      request.log.error({ error }, "Failed to persist report");
      return reply.code(500).send({ error: "Failed to persist report" });
    }
  });

  app.get("/rankings", async (request, reply) => {
    try {
      const filters = rankingsQuerySchema.parse(request.query);
      const reports = await reportStore.listReports(filters);
      const rankings = new Map<
        string,
        {
          apiId: string;
          provider: string;
          endpoint: string;
          category: string;
          reportCount: number;
          starScoreTotal: number;
          successCount: number;
          latencyTotal: number;
          latestTimestamp: string;
        }
      >();

      for (const report of reports) {
        const existing = rankings.get(report.apiId);

        if (existing) {
          existing.reportCount += 1;
          existing.starScoreTotal += report.starScore;
          existing.successCount += report.success ? 1 : 0;
          existing.latencyTotal += report.latencyMs;
          if (report.timestamp > existing.latestTimestamp) {
            existing.latestTimestamp = report.timestamp;
          }
          continue;
        }

        rankings.set(report.apiId, {
          apiId: report.apiId,
          provider: report.provider,
          endpoint: report.endpoint,
          category: report.category,
          reportCount: 1,
          starScoreTotal: report.starScore,
          successCount: report.success ? 1 : 0,
          latencyTotal: report.latencyMs,
          latestTimestamp: report.timestamp
        });
      }

      const items = Array.from(rankings.values())
        .map((ranking) => ({
          apiId: ranking.apiId,
          provider: ranking.provider,
          endpoint: ranking.endpoint,
          category: ranking.category,
          averageStarScore: ranking.starScoreTotal / ranking.reportCount,
          reportCount: ranking.reportCount,
          successRate: ranking.successCount / ranking.reportCount,
          averageLatencyMs: ranking.latencyTotal / ranking.reportCount,
          latestTimestamp: ranking.latestTimestamp
        }))
        .sort(
          (left, right) =>
            right.averageStarScore - left.averageStarScore ||
            right.reportCount - left.reportCount ||
            left.apiId.localeCompare(right.apiId)
        );

      return {
        category: filters.category,
        ...(filters.taskType ? { taskType: filters.taskType } : {}),
        items
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: "Invalid rankings query",
          issues: error.issues.map(({ path, message }) => ({ path, message }))
        });
      }

      request.log.error({ error }, "Failed to load rankings");
      return reply.code(500).send({ error: "Failed to load rankings" });
    }
  });

  app.get("/apis/:apiId", async (request, reply) => {
    try {
      const { apiId } = request.params as { apiId: string };
      const reports = await reportStore.listReportsByApiId(apiId);

      if (reports.length === 0) {
        return reply.code(404).send({ error: "API not found" });
      }

      const [firstReport] = reports;
      const recentReviews = [...reports]
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, 10);

      return {
        api: {
          apiId: firstReport.apiId,
          provider: firstReport.provider,
          endpoint: firstReport.endpoint,
          category: firstReport.category
        },
        stats: summarizeReports(reports),
        recentReviews
      };
    } catch (error) {
      request.log.error({ error }, "Failed to load API details");
      return reply.code(500).send({ error: "Failed to load API details" });
    }
  });

  return app;
}
