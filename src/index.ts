import Fastify from "fastify";
import { ZodError } from "zod";
import { createReportStore } from "./report-store.js";
import { parseReportInput, rankingsQuerySchema } from "./reports.js";

const app = Fastify({ logger: true });
const reportStore = createReportStore();

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
    const items = await reportStore.listRankings(filters);
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
    const detail = await reportStore.getApiDetail(apiId);
    if (!detail) {
      return reply.code(404).send({ error: "API not found" });
    }
    return detail;
  } catch (error) {
    request.log.error({ error }, "Failed to load API details");
    return reply.code(500).send({ error: "Failed to load API details" });
  }
});

app.listen({ port: Number(process.env.PORT ?? 3000) });
