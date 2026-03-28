import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("submits review payloads to Trustgate", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const submitReview = module.submitReview as
      | ((input: {
          trustgateBaseUrl: string;
          payload: Record<string, unknown>;
        }) => Promise<unknown>)
      | undefined;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ report: { apiId: "open-meteo-v1-forecast" } }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitReview?.({
        trustgateBaseUrl: "http://localhost:3000/",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 320,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 5
        }
      })
    ).resolves.toEqual({
      report: {
        apiId: "open-meteo-v1-forecast"
      }
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 320,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5
      })
    });
  });

  it("surfaces Trustgate submission failures", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const submitReview = module.submitReview as
      | ((input: {
          trustgateBaseUrl: string;
          payload: Record<string, unknown>;
        }) => Promise<unknown>)
      | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Invalid report payload" }), {
          status: 400,
          statusText: "Bad Request",
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    await expect(
      submitReview?.({
        trustgateBaseUrl: "http://localhost:3000",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 320,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 5
        }
      })
    ).rejects.toThrow(
      'Trustgate submission failed (400 Bad Request): {"error":"Invalid report payload"}'
    );
  });

  it("runs the concrete Open-Meteo review flow and submits the generated report", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const runOpenMeteoReview = module.runOpenMeteoReview as
      | ((input: {
          args: {
            provider: string;
            endpoint: string;
            category: string;
            taskType: string;
            trustgateBaseUrl: string;
            sourceType?: string;
            agentName?: string;
          };
          fetchImpl?: typeof fetch;
          now?: () => Date;
        }) => Promise<{
          reviewUrl: string;
          payload: Record<string, unknown>;
          submission: Record<string, unknown>;
        }>)
      | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.startsWith("https://api.open-meteo.com/v1/forecast?")) {
        return new Response(
          JSON.stringify({
            daily: {
              time: ["2026-03-29"],
              temperature_2m_max: [17.4],
              temperature_2m_min: [9.8]
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url === "http://localhost:3000/reports") {
        return new Response(JSON.stringify({ report: { apiId: "open-meteo-v1-forecast" } }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const now = () => new Date("2026-03-28T17:00:00.000Z");

    const result = await runOpenMeteoReview!({
      args: {
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        trustgateBaseUrl: "http://localhost:3000",
        sourceType: "agent",
        agentName: "codex"
      },
      fetchImpl: fetchMock,
      now
    });

    expect(result.reviewUrl).toContain("https://api.open-meteo.com/v1/forecast?");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]).toEqual([
      expect.stringContaining("https://api.open-meteo.com/v1/forecast?"),
      {
        headers: {
          accept: "application/json"
        }
      }
    ]);

    const reviewUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(reviewUrl.searchParams.get("latitude")).toBe("37.7749");
    expect(reviewUrl.searchParams.get("longitude")).toBe("-122.4194");
    expect(reviewUrl.searchParams.get("daily")).toBe("temperature_2m_max,temperature_2m_min");
    expect(reviewUrl.searchParams.get("timezone")).toBe("UTC");

    expect(result.payload).toMatchObject({
      provider: "Open-Meteo",
      endpoint: "/v1/forecast",
      category: "weather",
      taskType: "daily-forecast",
      success: true,
      starScore: 5,
      rateLimited: false,
      timestamp: "2026-03-28T17:00:00.000Z",
      comment: "Fast successful response with a clearly usable result.",
      sourceType: "agent",
      agentName: "codex"
    });
    expect(typeof result.payload.latencyMs).toBe("number");

    expect(fetchMock.mock.calls[1]).toEqual([
      "http://localhost:3000/reports",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(result.payload)
      }
    ]);
    expect(result.submission).toEqual({
      report: {
        apiId: "open-meteo-v1-forecast"
      }
    });
  });

  it("rejects unsupported concrete review flows", async () => {
    const module = (await import("../scripts/review-api.js")) as Record<
      string,
      unknown
    >;
    const runOpenMeteoReview = module.runOpenMeteoReview as
      | ((input: {
          args: {
            provider: string;
            endpoint: string;
            category: string;
            taskType: string;
            trustgateBaseUrl: string;
          };
        }) => Promise<unknown>)
      | undefined;

    await expect(
      runOpenMeteoReview?.({
        args: {
          provider: "OpenWeatherMap",
          endpoint: "/data/2.5/weather",
          category: "weather",
          taskType: "current-weather",
          trustgateBaseUrl: "http://localhost:3000"
        }
      })
    ).rejects.toThrow(
      "Only the Open-Meteo /v1/forecast weather daily-forecast review flow is implemented."
    );
  });
});
