import { describe, expect, it } from "vitest";

describe("review-api script contract", () => {
  it("exports a CLI argument parser", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;

    expect(typeof module.parseReviewArgs).toBe("function");
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
