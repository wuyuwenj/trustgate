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

  it("returns rankings using the store-provided aggregate fields", async () => {
    const weatherRankings: RankingEntry[] = [
      {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        avgStarScore: 4.5,
        reviewCount: 2,
        successRate: 0.5,
        medianLatencyMs: 500,
        rateLimitedCount: 1
      },
      {
        apiId: "weatherapi-com-v1-current-json",
        provider: "WeatherAPI.com",
        endpoint: "/v1/current.json",
        category: "weather",
        avgStarScore: 3,
        reviewCount: 1,
        successRate: 1,
        medianLatencyMs: 290,
        rateLimitedCount: 0
      }
    ];
    listRankings.mockResolvedValue(weatherRankings);

    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=weather"
    });

    expect(response.statusCode).toBe(200);
    expect(listRankings).toHaveBeenCalledWith({ category: "weather" });
    expect(response.json()).toEqual({
      category: "weather",
      items: weatherRankings
    });
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
    listReportsByApiId.mockResolvedValue([
      makeReport({
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5,
        latencyMs: 320,
        comment: "Fast and consistent forecast data.",
        agentName: "codex",
        sourceType: "agent"
      }),
      makeReport({
        timestamp: "2026-03-28T18:00:00Z",
        starScore: 3,
        latencyMs: 680,
        success: false,
        rateLimited: true,
        taskType: "hourly-forecast"
      })
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/apis/open-meteo-v1-forecast"
    });

    expect(response.statusCode).toBe(200);
    expect(listReportsByApiId).toHaveBeenCalledWith("open-meteo-v1-forecast");
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
    expect(listReportsByApiId).toHaveBeenCalledWith("missing-api");
    expect(response.json()).toEqual({ error: "API not found" });
  });
});
