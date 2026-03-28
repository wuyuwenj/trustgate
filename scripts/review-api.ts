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

export type RunOpenMeteoReviewInput = {
  args: ReviewCliArgs;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const MAX_COMMENT_LENGTH = 500;
const OPEN_METEO_PROVIDER = "Open-Meteo";
const OPEN_METEO_ENDPOINT = "/v1/forecast";
const OPEN_METEO_CATEGORY = "weather";
const OPEN_METEO_TASK_TYPE = "daily-forecast";
const OPEN_METEO_LATITUDE = "37.7749";
const OPEN_METEO_LONGITUDE = "-122.4194";
const OPEN_METEO_DAILY_FIELDS = ["temperature_2m_max", "temperature_2m_min"];

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

function isOpenMeteoDailyForecastResponse(
  body: unknown
): body is {
  daily: {
    time: unknown[];
    temperature_2m_max: unknown[];
    temperature_2m_min: unknown[];
  };
} {
  if (typeof body !== "object" || body === null || !("daily" in body)) {
    return false;
  }

  const { daily } = body;

  if (typeof daily !== "object" || daily === null) {
    return false;
  }

  if (
    !("time" in daily) ||
    !("temperature_2m_max" in daily) ||
    !("temperature_2m_min" in daily)
  ) {
    return false;
  }

  return (
    Array.isArray(daily.time) &&
    daily.time.length > 0 &&
    Array.isArray(daily.temperature_2m_max) &&
    daily.temperature_2m_max.length > 0 &&
    Array.isArray(daily.temperature_2m_min) &&
    daily.temperature_2m_min.length > 0
  );
}

function assertSupportedOpenMeteoReview(args: ReviewCliArgs) {
  if (
    args.provider !== OPEN_METEO_PROVIDER ||
    args.endpoint !== OPEN_METEO_ENDPOINT ||
    args.category !== OPEN_METEO_CATEGORY ||
    args.taskType !== OPEN_METEO_TASK_TYPE
  ) {
    throw new Error(
      "Only the Open-Meteo /v1/forecast weather daily-forecast review flow is implemented."
    );
  }
}

function buildOpenMeteoForecastUrl() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", OPEN_METEO_LATITUDE);
  url.searchParams.set("longitude", OPEN_METEO_LONGITUDE);
  url.searchParams.set("daily", OPEN_METEO_DAILY_FIELDS.join(","));
  url.searchParams.set("timezone", "UTC");
  return url.toString();
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

export async function runOpenMeteoReview(input: RunOpenMeteoReviewInput) {
  assertSupportedOpenMeteoReview(input.args);

  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  const reviewUrl = buildOpenMeteoForecastUrl();
  const measuredCall = await measureLatency(async () => {
    try {
      const response = await fetchImpl(reviewUrl, {
        headers: {
          accept: "application/json"
        }
      });
      const body = await response.json().catch(() => null);

      return {
        statusCode: response.status,
        body,
        error: undefined
      };
    } catch (error) {
      return {
        statusCode: null,
        body: null,
        error
      };
    }
  });
  const classified = classifyApiResult({
    statusCode: measuredCall.result.statusCode,
    error: measuredCall.result.error
  });
  const success =
    classified.success && isOpenMeteoDailyForecastResponse(measuredCall.result.body);
  const starScore = scoreReview({
    success,
    latencyMs: measuredCall.latencyMs,
    rateLimited: classified.rateLimited
  });
  const payload = buildReviewPayload({
    provider: input.args.provider,
    endpoint: input.args.endpoint,
    category: input.args.category,
    taskType: input.args.taskType,
    success,
    latencyMs: measuredCall.latencyMs,
    timestamp: now().toISOString(),
    starScore,
    rateLimited: classified.rateLimited,
    comment: generateReviewComment({
      success,
      latencyMs: measuredCall.latencyMs,
      rateLimited: classified.rateLimited,
      starScore
    }),
    sourceType: input.args.sourceType,
    agentName: input.args.agentName
  });
  const submission = await submitReview({
    trustgateBaseUrl: input.args.trustgateBaseUrl,
    payload,
    fetchImpl
  });

  return {
    reviewUrl,
    payload,
    submission
  };
}

function isMainModule() {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isMainModule()) {
  void (async () => {
    try {
      const args = parseReviewArgs();
      const review = await runOpenMeteoReview({ args });

      console.log(JSON.stringify(review, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(message);
      process.exitCode = 1;
    }
  })();
} else {
  try {
    // Preserve the current module side effects for tests that import synchronously.
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    process.exitCode = 1;
  }
}
