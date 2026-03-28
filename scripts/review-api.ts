import { pathToFileURL } from "node:url";
import {
  reportCategorySchema,
  type ReportCategory,
  type ReportInput
} from "../src/reports.js";

export type ReviewCliArgs = {
  provider: string;
  endpoint: string;
  category: ReportCategory;
  taskType: string;
  trustgateBaseUrl: string;
  sourceType?: string;
  agentName?: string;
};

export type ClassifiedReviewOutcome = {
  success: boolean;
  rateLimited: boolean;
};

export type ReviewScoreInput = {
  success: boolean;
  latencyMs: number;
  rateLimited: boolean;
};

export type ReviewCommentInput = ReviewScoreInput & {
  starScore: number;
};

export type SubmitReviewInput = {
  trustgateBaseUrl: string;
  payload: ReportInput;
  fetchImpl?: typeof fetch;
};

const MAX_COMMENT_LENGTH = 500;

const FLAG_NAMES = new Set([
  "--provider",
  "--endpoint",
  "--category",
  "--task-type",
  "--trustgate-url",
  "--source-type",
  "--agent-name"
]);

function normalizeValue(value: string, flag: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Flag ${flag} requires a non-empty value.`);
  }

  return normalized;
}

function parseRawArgs(argv: string[]) {
  const values: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help") {
      values.help = "true";
      continue;
    }

    const [flag, inlineValue] = token.split("=", 2);

    if (!FLAG_NAMES.has(flag)) {
      throw new Error(`Unknown flag: ${flag}`);
    }

    const nextValue = inlineValue ?? argv[index + 1];

    if (nextValue === undefined || FLAG_NAMES.has(nextValue)) {
      throw new Error(`Flag ${flag} requires a value.`);
    }

    values[flag] = normalizeValue(nextValue, flag);

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return values;
}

function normalizeBaseUrl(input: string) {
  const url = new URL(input);
  return url.toString().replace(/\/$/, "");
}

export function parseReviewArgs(argv: string[] = process.argv.slice(2)): ReviewCliArgs {
  const values = parseRawArgs(argv);

  if (values.help === "true") {
    throw new Error(getUsageText());
  }

  return {
    provider: normalizeValue(values["--provider"] ?? "", "--provider"),
    endpoint: normalizeValue(values["--endpoint"] ?? "", "--endpoint"),
    category: reportCategorySchema.parse(values["--category"]),
    taskType: normalizeValue(values["--task-type"] ?? "", "--task-type"),
    trustgateBaseUrl: normalizeBaseUrl(
      values["--trustgate-url"] ?? process.env.TRUSTGATE_BASE_URL ?? "http://localhost:3000"
    ),
    sourceType: values["--source-type"],
    agentName: values["--agent-name"]
  };
}

export function getUsageText() {
  return [
    "Usage: tsx scripts/review-api.ts --provider <name> --endpoint <path> --category <llm|weather|data> --task-type <name> [options]",
    "",
    "Options:",
    "  --trustgate-url <url>  Trustgate base URL. Defaults to TRUSTGATE_BASE_URL or http://localhost:3000",
    "  --source-type <value>  Optional provenance source type",
    "  --agent-name <value>   Optional agent name"
  ].join("\n");
}

export async function measureLatency<T>(
  operation: () => Promise<T> | T
): Promise<{ result: T; latencyMs: number }> {
  const startedAt = performance.now();
  const result = await operation();
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));

  return {
    result,
    latencyMs
  };
}

function isRateLimitError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /\b429\b|rate limit|too many requests/i.test(error.message);
}

export function classifyApiResult(input: {
  statusCode?: number | null;
  error?: unknown;
}): ClassifiedReviewOutcome {
  if (input.statusCode === 429 || isRateLimitError(input.error)) {
    return {
      success: false,
      rateLimited: true
    };
  }

  if (typeof input.statusCode === "number") {
    return {
      success: input.statusCode >= 200 && input.statusCode < 300,
      rateLimited: false
    };
  }

  return {
    success: false,
    rateLimited: false
  };
}

export function scoreReview(input: ReviewScoreInput) {
  if (!input.success || input.rateLimited) {
    return 1;
  }

  if (input.latencyMs <= 500) {
    return 5;
  }

  if (input.latencyMs <= 1_500) {
    return 4;
  }

  if (input.latencyMs <= 3_000) {
    return 3;
  }

  return 2;
}

export function generateReviewComment(input: ReviewCommentInput) {
  let comment: string;

  if (input.rateLimited) {
    comment = "Request was rate limited before the API produced a usable result.";
  } else if (!input.success) {
    comment = "API call failed before returning a usable result.";
  } else if (input.starScore >= 5) {
    comment = "Fast successful response with a clearly usable result.";
  } else if (input.starScore === 4) {
    comment = "Successful response with minor latency but still usable.";
  } else if (input.starScore === 3) {
    comment = "Successful response, but latency was noticeable.";
  } else {
    comment = "API call succeeded, but latency made the experience poor.";
  }

  return comment.slice(0, MAX_COMMENT_LENGTH);
}

export function buildReviewPayload(input: ReportInput): ReportInput {
  return {
    ...input
  };
}

export async function submitReview(input: SubmitReviewInput) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${normalizeBaseUrl(input.trustgateBaseUrl)}/reports`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input.payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const errorDetail = errorBody.trim();

    throw new Error(
      `Trustgate submission failed (${response.status} ${response.statusText})${
        errorDetail ? `: ${errorDetail}` : ""
      }`
    );
  }

  return response.json();
}

function isMainModule() {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const args = parseReviewArgs();
    console.log(JSON.stringify(args, null, 2));
    console.log("TODO: implement real API review runner");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    process.exitCode = 1;
  }
}
