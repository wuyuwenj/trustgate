import Fastify from "fastify";
import { ZodError } from "zod";
import { createReportStore, type ReportStore } from "./report-store.js";
import { parseReportInput } from "./reports.js";

interface BuildAppOptions {
  reportStore?: ReportStore;
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

  app.get("/rankings", async () => {
    throw new Error("GET /rankings is not implemented yet");
  });

  app.get("/apis/:apiId", async () => {
    throw new Error("GET /apis/:apiId is not implemented yet");
  });

  return app;
}
