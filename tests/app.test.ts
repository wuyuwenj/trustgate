import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { ReportStore } from "../src/report-store.js";
import type { ParsedReport } from "../src/reports.js";

describe("Trustgate API", () => {
  let app: ReturnType<typeof buildApp>;
  const createReport = vi.fn<(report: ParsedReport) => Promise<ParsedReport>>();
  const listReports = vi.fn<
    (filters: { category: "llm" | "weather" | "data"; taskType?: string }) => Promise<ParsedReport[]>
  >();
  const listRankings = vi.fn<ReportStore["listRankings"]>();
  const listReportsByApiId = vi.fn<(apiId: string) => Promise<ParsedReport[]>>();

  beforeEach(() => {
    createReport.mockReset();
    listReports.mockReset();
    listRankings.mockReset();
    listReportsByApiId.mockReset();
    createReport.mockImplementation(async (report) => report);
    listReports.mockResolvedValue([]);
    listRankings.mockResolvedValue([]);
    listReportsByApiId.mockResolvedValue([]);
    app = buildApp({
      reportStore: {
        createReport,
        listReports,
        listRankings,
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

  it("returns rankings grouped by API", async () => {
    listReports.mockResolvedValue([
      {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 320,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5
      },
      {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: false,
        latencyMs: 680,
        timestamp: "2026-03-28T18:00:00Z",
        starScore: 4
      },
      {
        apiId: "weatherapi-com-v1-current-json",
        provider: "WeatherAPI.com",
        endpoint: "/v1/current.json",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 290,
        timestamp: "2026-03-28T16:00:00Z",
        starScore: 3
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=weather"
    });

    expect(response.statusCode).toBe(200);
    expect(listReports).toHaveBeenCalledWith({ category: "weather" });
    expect(response.json()).toEqual({
      category: "weather",
      items: [
        {
          apiId: "open-meteo-v1-forecast",
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          averageStarScore: 4.5,
          reportCount: 2,
          successRate: 0.5,
          averageLatencyMs: 500,
          latestTimestamp: "2026-03-28T18:00:00Z"
        },
        {
          apiId: "weatherapi-com-v1-current-json",
          provider: "WeatherAPI.com",
          endpoint: "/v1/current.json",
          category: "weather",
          averageStarScore: 3,
          reportCount: 1,
          successRate: 1,
          averageLatencyMs: 290,
          latestTimestamp: "2026-03-28T16:00:00Z"
        }
      ]
    });
  });

  it("supports optional task filtering for rankings", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/rankings?category=weather&taskType=daily-forecast"
    });

    expect(response.statusCode).toBe(200);
    expect(listReports).toHaveBeenCalledWith({
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
    expect(listReports).not.toHaveBeenCalled();
    expect(response.json()).toEqual(
      expect.objectContaining({
        error: "Invalid rankings query",
        issues: expect.any(Array)
      })
    );
  });

  it("returns API details with aggregated stats and recent reviews", async () => {
    listReportsByApiId.mockResolvedValue([
      {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 320,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5,
        comment: "Fast and consistent forecast data."
      },
      {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "hourly-forecast",
        success: false,
        latencyMs: 680,
        timestamp: "2026-03-28T18:00:00Z",
        starScore: 3,
        rateLimited: true
      }
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
        category: "weather"
      },
      stats: {
        averageStarScore: 4,
        reportCount: 2,
        successRate: 0.5,
        averageLatencyMs: 500,
        latestTimestamp: "2026-03-28T18:00:00Z"
      },
      recentReviews: [
        {
          apiId: "open-meteo-v1-forecast",
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "hourly-forecast",
          success: false,
          latencyMs: 680,
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3,
          rateLimited: true
        },
        {
          apiId: "open-meteo-v1-forecast",
          provider: "Open-Meteo",
          endpoint: "/v1/forecast",
          category: "weather",
          taskType: "daily-forecast",
          success: true,
          latencyMs: 320,
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 5,
          comment: "Fast and consistent forecast data."
        }
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
