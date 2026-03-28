import { z } from "zod";

const reportCategorySchema = z.enum(["llm", "weather", "data"]);

const optionalTrimmedString = z.string().trim().min(1);

export const reportInputSchema = z.object({
  provider: z.string().trim().min(1),
  endpoint: z.string().trim().min(1),
  category: reportCategorySchema,
  taskType: z.string().trim().min(1),
  success: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  starScore: z.number().int().min(1).max(5),
  rateLimited: z.boolean().optional(),
  comment: z.string().trim().max(500).optional(),
  sourceType: optionalTrimmedString.optional(),
  agentName: optionalTrimmedString.optional()
});

export function normalizeApiId(provider: string, endpoint: string) {
  return `${provider}-${endpoint}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function parseReportInput(input: unknown) {
  const report = reportInputSchema.parse(input);

  return {
    ...report,
    apiId: normalizeApiId(report.provider, report.endpoint)
  };
}

export type ReportInput = z.input<typeof reportInputSchema>;
export type ParsedReport = ReturnType<typeof parseReportInput>;
