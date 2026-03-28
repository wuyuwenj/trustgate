import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type {
  ApiDetail,
  RankingEntry,
  ReportStore,
  StoredReport
} from "../src/report-store.js";
import { parseReportInput } from "../src/reports.js";

function makeReport(
  overrides: Partial<StoredReport> = {}
): StoredReport {
  const report = parseReportInput({
    provider: "Open-Meteo",
    endpoint: "/v1/forecast",
    category: "weather",
    taskType: "daily-forecast",
    success: true,
    latencyMs: 412,
    timestamp: "2026-03-28T17:00:00Z",
    starScore: 5,
    ...overrides
  });

  return {
    ...report,
    ...overrides
  };
}

describe("Trustgate API", () => {
  let app: ReturnType<typeof buildApp>;
  const createReport = vi.fn<ReportStore["createReport"]>();
  const listReports = vi.fn<ReportStore["listReports"]>();
  const listRankings = vi.fn<ReportStore["listRankings"]>();
  const getApiDetail = vi.fn<ReportStore["getApiDetail"]>();
  const listReportsByApiId = vi.fn<ReportStore["listReportsByApiId"]>();

  beforeEach(() => {
    createReport.mockReset();
    listReports.mockReset();
    listRankings.mockReset();
    getApiDetail.mockReset();
    listReportsByApiId.mockReset();

    createReport.mockImplementation(async (report) => report);
    listReports.mockResolvedValue([]);
    listRankings.mockResolvedValue([]);
    getApiDetail.mockResolvedValue(null as ApiDetail | null);
    listReportsByApiId.mockResolvedValue([]);

    app = buildApp({
      reportStore: {
        createReport,
        listReports,
        listRankings,
        getApiDetail,
        listReportsByApiId
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("accepts a valid review report", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/reports",
      payload: {
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 412,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5,
        rateLimited: false,
        comment: "Fast and consistent forecast data.",
        sourceType: "agent",
        agentName: "codex"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        apiId: "open-meteo-v1-forecast",
        category: "weather",
        starScore: 5
      })
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        report: expect.objectContaining({
          apiId: "open-meteo-v1-forecast",
          provider: "Open-Meteo",
          endpoint: "/v1/forecast"
        })
      })
    );
  });

  it("rejects an invalid review report", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/reports",
      payload: {
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 412,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 7
      }
    });

    expect(response.statusCode).toBe(400);
    expect(createReport).not.toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: "Invalid report payload",
        issues: expect.any(Array)
      })
    );
  });

  it("returns 200 for rankings requests", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=weather"
    });

    expect(response.statusCode).toBe(200);
  });

  it("returns an items array for rankings requests", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=weather"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        items: expect.any(Array)
      })
    );
  });

  it("returns seeded rankings when no reports have been submitted", async () => {
    const seededApp = buildApp();

    try {
      const response = await seededApp.inject({
        method: "GET",
        url: "/rankings?category=weather"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        category: "weather",
        items: [
          expect.objectContaining({
            apiId: "open-meteo-v1-forecast",
            provider: "Open-Meteo",
            endpoint: "/v1/forecast",
            category: "weather",
            avgStarScore: 0,
            reviewCount: 0,
            successRate: 0,
            medianLatencyMs: 0,
            rateLimitedCount: 0
          }),
          expect.objectContaining({
            apiId: "openweathermap-data-2-5-weather",
            provider: "OpenWeatherMap",
            endpoint: "/data/2.5/weather",
            category: "weather",
            avgStarScore: 0,
            reviewCount: 0,
            successRate: 0,
            medianLatencyMs: 0,
            rateLimitedCount: 0
          }),
          expect.objectContaining({
            apiId: "noaa-weather-gov-points",
            provider: "NOAA weather.gov",
            endpoint: "/points",
            category: "weather",
            avgStarScore: 0,
            reviewCount: 0,
            successRate: 0,
            medianLatencyMs: 0,
            rateLimitedCount: 0
          })
        ]
      });
    } finally {
      await seededApp.close();
    }
  });

  it("supports optional task filtering for rankings", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=weather&taskType=daily-forecast"
    });

    expect(response.statusCode).toBe(200);
    expect(listRankings).toHaveBeenCalledWith({
      category: "weather",
      taskType: "daily-forecast"
    });
  });

  it("returns only rankings for the requested taskType", async () => {
    const filteredApp = buildApp();

    try {
      await filteredApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 412,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 5
        }
      });
      await filteredApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "hourly-forecast",
          success: true,
          latencyMs: 398,
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 4
        }
      });

      const response = await filteredApp.inject({
        method: "GET",
        url: "/rankings?category=weather&taskType=hourly-forecast"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        category: "weather",
        taskType: "hourly-forecast",
        items: [
          {
            apiId: "open-meteo-v1-forecast",
            provider: "Open-Meteo",
            endpoint: "/v1/forecast",
            category: "weather",
            avgStarScore: 4,
            reviewCount: 1,
            successRate: 1,
            medianLatencyMs: 398,
            rateLimitedCount: 0
          }
        ]
      });
    } finally {
      await filteredApp.close();
    }
  });

  it("returns ranking aggregation math for submitted reports", async () => {
    const rankedApp = buildApp();

    try {
      await rankedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 280,
          timestamp: "2026-03-28T16:00:00Z",
          starScore: 5
        }
      });
      await rankedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 450,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 4,
          rateLimited: true
        }
      });
      await rankedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: false,
          latencyMs: 900,
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3
        }
      });

      const response = await rankedApp.inject({
        method: "GET",
        url: "/rankings?category=weather"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        category: "weather",
        items: [
          {
            apiId: "open-meteo-v1-forecast",
            provider: "Open-Meteo",
            endpoint: "/v1/forecast",
            category: "weather",
            avgStarScore: 4,
            reviewCount: 3,
            successRate: 2 / 3,
            medianLatencyMs: 450,
            rateLimitedCount: 1
          }
        ]
      });
    } finally {
      await rankedApp.close();
    }
  });

  it("returns 200 for API detail requests", async () => {
    getApiDetail.mockResolvedValue({
      api: {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        avgStarScore: 5,
        reviewCount: 1,
        successRate: 1,
        medianLatencyMs: 412,
        rateLimitedCount: 0
      },
      reviews: [
        makeReport({
          timestamp: "2026-03-28T18:00:00Z"
        })
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: "/apis/open-meteo-v1-forecast"
    });

    expect(response.statusCode).toBe(200);
  });

  it("returns seeded API details when no reports have been submitted", async () => {
    const seededApp = buildApp();

    try {
      const response = await seededApp.inject({
        method: "GET",
        url: "/apis/open-meteo-v1-forecast"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        api: {
          apiId: "open-meteo-v1-forecast",
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          avgStarScore: 0,
          reviewCount: 0,
          successRate: 0,
          medianLatencyMs: 0,
          rateLimitedCount: 0
        },
        reviews: []
      });
    } finally {
      await seededApp.close();
    }
  });

  it("returns API detail aggregation for submitted reports", async () => {
    const detailedApp = buildApp();

    try {
      await detailedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 280,
          timestamp: "2026-03-28T16:00:00Z",
          starScore: 5
        }
      });
      await detailedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 450,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 4,
          rateLimited: true
        }
      });
      await detailedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: false,
          latencyMs: 900,
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3
        }
      });

      const response = await detailedApp.inject({
        method: "GET",
        url: "/apis/open-meteo-v1-forecast"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(
        expect.objectContaining({
          api: {
            apiId: "open-meteo-v1-forecast",
            provider: "Open-Meteo",
            endpoint: "/v1/forecast",
            category: "weather",
            avgStarScore: 4,
            reviewCount: 3,
            successRate: 2 / 3,
            medianLatencyMs: 450,
            rateLimitedCount: 1
          },
          reviews: expect.any(Array)
        })
      );
    } finally {
      await detailedApp.close();
    }
  });

  it("returns recent reviews in newest-first order for API detail responses", async () => {
    const detailedApp = buildApp();

    try {
      await detailedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 280,
          timestamp: "2026-03-28T16:00:00Z",
          starScore: 5
        }
      });
      await detailedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 450,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 4
        }
      });
      await detailedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: false,
          latencyMs: 900,
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3
        }
      });

      const response = await detailedApp.inject({
        method: "GET",
        url: "/apis/open-meteo-v1-forecast"
      });

      expect(response.statusCode).toBe(200);
      expect(
        response
          .json()
          .reviews.map((review: { timestamp: string }) => review.timestamp)
      ).toEqual([
        "2026-03-28T18:00:00Z",
        "2026-03-28T17:00:00Z",
        "2026-03-28T16:00:00Z"
      ]);
    } finally {
      await detailedApp.close();
    }
  });

  it("returns reviewCount in ranking items", async () => {
    const rankedApp = buildApp();

    try {
      await rankedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 412,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 5
        }
      });
      await rankedApp.inject({
        method: "POST",
        url: "/reports",
        payload: {
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: false,
          latencyMs: 650,
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3
        }
      });

      const response = await rankedApp.inject({
        method: "GET",
        url: "/rankings?category=weather"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        category: "weather",
        items: [
          {
            apiId: "open-meteo-v1-forecast",
            provider: "Open-Meteo",
            endpoint: "/v1/forecast",
            category: "weather",
            avgStarScore: 4,
            reviewCount: 2,
            successRate: 0.5,
            medianLatencyMs: 531,
            rateLimitedCount: 0
          }
        ]
      });
    } finally {
      await rankedApp.close();
    }
  });

  it("rejects an invalid rankings query", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=finance"
    });

    expect(response.statusCode).toBe(400);
    expect(listRankings).not.toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: "Invalid rankings query",
        issues: expect.any(Array)
      })
    );
  });

  it("returns API details with aggregate profile fields and recent reviews", async () => {
    getApiDetail.mockResolvedValue({
      api: {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        avgStarScore: 4,
        reviewCount: 2,
        successRate: 0.5,
        medianLatencyMs: 500,
        rateLimitedCount: 1
      },
      reviews: [
        makeReport({
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3,
          latencyMs: 680,
          success: false,
          rateLimited: true,
          taskType: "hourly-forecast"
        }),
        makeReport({
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 5,
          latencyMs: 320,
          comment: "Fast and consistent forecast data.",
          agentName: "codex",
          sourceType: "agent"
        })
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: "/apis/open-meteo-v1-forecast"
    });

    expect(response.statusCode).toBe(200);
    expect(getApiDetail).toHaveBeenCalledWith("open-meteo-v1-forecast");
    expect(response.json()).toEqual({
      api: {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        avgStarScore: 4,
        reviewCount: 2,
        successRate: 0.5,
        medianLatencyMs: 500,
        rateLimitedCount: 1
      },
      reviews: [
        expect.objectContaining({
          timestamp: "2026-03-28T18:00:00Z",
          taskType: "hourly-forecast",
          rateLimited: true
        }),
        expect.objectContaining({
          timestamp: "2026-03-28T17:00:00Z",
          comment: "Fast and consistent forecast data.",
          sourceType: "agent",
          agentName: "codex"
        })
      ]
    });
  });

  it("returns 404 when API details are missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/apis/missing-api"
    });

    expect(response.statusCode).toBe(404);
    expect(getApiDetail).toHaveBeenCalledWith("missing-api");
    expect(response.json()).toEqual({ error: "API not found" });
  });
});
