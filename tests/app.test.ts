import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { ParsedReport } from "../src/reports.js";

describe("Trustgate API", () => {
  let app: ReturnType<typeof buildApp>;
  const createReport = vi.fn<(report: ParsedReport) => Promise<ParsedReport>>();

  beforeEach(() => {
    createReport.mockReset();
    createReport.mockImplementation(async (report) => report);
    app = buildApp({
      reportStore: {
        createReport
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

  it("returns an API detail page with reviews", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/apis/open-meteo-v1-forecast"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        api: expect.any(Object),
        reviews: expect.any(Array)
      })
    );
  });
});
