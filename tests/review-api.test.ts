import { describe, expect, it } from "vitest";

describe("review-api script contract", () => {
  it("exports a CLI argument parser", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;

    expect(typeof module.parseReviewArgs).toBe("function");
  });

  it("parses the required CLI arguments", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const parseReviewArgs = module.parseReviewArgs as
      | ((argv: string[]) => unknown)
      | undefined;

    expect(
      parseReviewArgs?.([
        "--provider",
        "Open-Meteo",
        "--endpoint",
        "/v1/forecast",
        "--category",
        "weather",
        "--task-type",
        "daily-forecast"
      ])
    ).toEqual({
      provider: "Open-Meteo",
      endpoint: "/v1/forecast",
      category: "weather",
      taskType: "daily-forecast",
      trustgateBaseUrl: "http://localhost:3000"
    });
  });

  it("rejects invalid CLI arguments", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const parseReviewArgs = module.parseReviewArgs as
      | ((argv: string[]) => unknown)
      | undefined;

    expect(() =>
      parseReviewArgs?.([
        "--provider",
        "Open-Meteo",
        "--endpoint",
        "/v1/forecast",
        "--category",
        "finance",
        "--task-type",
        "daily-forecast"
      ])
    ).toThrow();

    expect(() =>
      parseReviewArgs?.([
        "--provider",
        "Open-Meteo",
        "--endpoint",
        "/v1/forecast",
        "--category",
        "weather"
      ])
    ).toThrow("Flag --task-type requires a non-empty value.");
  });

  it("exports a latency helper that measures an API call duration", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const measureLatency = module.measureLatency as
      | (<T>(operation: () => Promise<T> | T) => Promise<{ result: T; latencyMs: number }>)
      | undefined;

    expect(typeof measureLatency).toBe("function");

    const measured = await measureLatency!(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "ok";
    });

    expect(measured.result).toBe("ok");
    expect(Number.isInteger(measured.latencyMs)).toBe(true);
    expect(measured.latencyMs).toBeGreaterThanOrEqual(10);
  });

  it("exports a helper that classifies success, failure, and rate limiting", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const classifyApiResult = module.classifyApiResult as
      | ((input: { statusCode?: number | null; error?: unknown }) => {
          success: boolean;
          rateLimited: boolean;
        })
      | undefined;

    expect(typeof classifyApiResult).toBe("function");
    expect(classifyApiResult?.({ statusCode: 200 })).toEqual({
      success: true,
      rateLimited: false
    });
    expect(classifyApiResult?.({ statusCode: 503 })).toEqual({
      success: false,
      rateLimited: false
    });
    expect(classifyApiResult?.({ statusCode: 429 })).toEqual({
      success: false,
      rateLimited: true
    });
  });

  it("exports a review scoring helper that returns integer star scores", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const scoreReview = module.scoreReview as
      | ((input: {
          success: boolean;
          latencyMs: number;
          rateLimited: boolean;
        }) => number)
      | undefined;

    expect(typeof scoreReview).toBe("function");
    expect(
      scoreReview?.({
        success: true,
        latencyMs: 320,
        rateLimited: false
      })
    ).toBe(5);
    expect(
      scoreReview?.({
        success: false,
        latencyMs: 3000,
        rateLimited: false
      })
    ).toBe(1);
  });

  it("exports a comment generator for review submissions", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const generateReviewComment = module.generateReviewComment as
      | ((input: {
          success: boolean;
          latencyMs: number;
          rateLimited: boolean;
          starScore: number;
        }) => string)
      | undefined;

    expect(typeof generateReviewComment).toBe("function");
    expect(
      generateReviewComment?.({
        success: true,
        latencyMs: 320,
        rateLimited: false,
        starScore: 5
      })
    ).toBe("Fast successful response with a clearly usable result.");
    expect(
      generateReviewComment?.({
        success: false,
        latencyMs: 0,
        rateLimited: true,
        starScore: 1
      })
    ).toBe("Request was rate limited before the API produced a usable result.");
  });

  it("exports a payload builder for POST /reports", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const buildReviewPayload = module.buildReviewPayload as
      | ((input: {
          provider: string;
          endpoint: string;
          category: string;
          taskType: string;
          success: boolean;
          latencyMs: number;
          timestamp: string;
          starScore: number;
          comment: string;
          sourceType: string;
          agentName: string;
        }) => unknown)
      | undefined;

    expect(typeof buildReviewPayload).toBe("function");
    expect(
      buildReviewPayload?.({
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 320,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5,
        comment: "Fast and consistent forecast data.",
        sourceType: "agent",
        agentName: "codex"
      })
    ).toEqual({
      provider: "Open-Meteo",
      endpoint: "/v1/forecast",
      category: "weather",
      taskType: "daily-forecast",
      success: true,
      latencyMs: 320,
      timestamp: "2026-03-28T17:00:00Z",
      starScore: 5,
      comment: "Fast and consistent forecast data.",
      sourceType: "agent",
      agentName: "codex"
    });
  });
});
