import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";
import { createReportStore } from "../src/report-store.js";
import { parseReportInput } from "../src/reports.js";

function makeReport(
  overrides: Partial<ReturnType<typeof parseReportInput>> = {}
) {
  return parseReportInput({
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
}

describe("in-memory report store", () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = originalEnv.SUPABASE_ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("returns seeded weather rankings when no reports have been submitted", async () => {
    const store = createReportStore();

    const rankings = await store.listRankings({ category: "weather" });

    expect(rankings.map((entry) => entry.provider)).toEqual([
      "Open-Meteo",
      "OpenWeatherMap",
      "NOAA weather.gov"
    ]);
    expect(rankings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          apiId: "open-meteo-v1-forecast",
          category: "weather"
        })
      ])
    );
  });

  it("aggregates submitted reports into ranking entries with medians and rate-limit counts", async () => {
    const store = createReportStore();

    await store.createReport(
      makeReport({
        latencyMs: 280,
        starScore: 5,
        timestamp: "2026-03-28T16:00:00Z"
      })
    );
    await store.createReport(
      makeReport({
        latencyMs: 450,
        starScore: 4,
        timestamp: "2026-03-28T17:00:00Z",
        rateLimited: true
      })
    );
    await store.createReport(
      makeReport({
        latencyMs: 900,
        starScore: 3,
        timestamp: "2026-03-28T18:00:00Z",
        success: false
      })
    );
    await store.createReport(
      makeReport({
        provider: "OpenWeatherMap",
        endpoint: "/data/2.5/weather",
        latencyMs: 320,
        starScore: 4,
        timestamp: "2026-03-28T19:00:00Z"
      })
    );

    const rankings = await store.listRankings({ category: "weather" });

    expect(rankings).toEqual([
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
      },
      {
        apiId: "openweathermap-data-2-5-weather",
        provider: "OpenWeatherMap",
        endpoint: "/data/2.5/weather",
        category: "weather",
        avgStarScore: 4,
        reviewCount: 1,
        successRate: 1,
        medianLatencyMs: 320,
        rateLimitedCount: 0
      }
    ]);
  });

  it("filters rankings by taskType", async () => {
    const store = createReportStore();

    await store.createReport(makeReport({ taskType: "daily-forecast" }));
    await store.createReport(
      makeReport({
        taskType: "hourly-forecast",
        timestamp: "2026-03-28T18:00:00Z"
      })
    );

    const rankings = await store.listRankings({
      category: "weather",
      taskType: "hourly-forecast"
    });

    expect(rankings).toEqual([
      expect.objectContaining({
        apiId: "open-meteo-v1-forecast",
        reviewCount: 1
      })
    ]);
  });
});
