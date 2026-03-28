import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { createReportStore } from "../src/report-store.js";
import { parseReportInput } from "../src/reports.js";

const mockSupabaseReports: ReturnType<typeof parseReportInput>[] = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from(table: string) {
      if (table !== "reports") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert(report: ReturnType<typeof parseReportInput>) {
          mockSupabaseReports.push(report);

          return {
            select() {
              return {
                async single() {
                  return { data: report, error: null };
                }
              };
            }
          };
        },
        select() {
          const filters = new Map<string, unknown>();

          const query = {
            data: mockSupabaseReports as ReturnType<typeof parseReportInput>[],
            error: null as Error | null,
            eq(column: string, value: unknown) {
              filters.set(column, value);
              this.data = mockSupabaseReports.filter((report) =>
                Array.from(filters.entries()).every(
                  ([filterColumn, filterValue]) =>
                    report[filterColumn as keyof typeof report] === filterValue
                )
              );
              return this;
            }
          };

          return query;
        }
      };
    }
  }))
}));

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
    mockSupabaseReports.length = 0;
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

  it("sorts ranking items by average star score descending by default", async () => {
    const store = createReportStore();

    await store.createReport(
      makeReport({
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        starScore: 2
      })
    );
    await store.createReport(
      makeReport({
        provider: "OpenWeatherMap",
        endpoint: "/data/2.5/weather",
        starScore: 5,
        timestamp: "2026-03-28T18:00:00Z"
      })
    );

    const rankings = await store.listRankings({ category: "weather" });

    expect(rankings.map((ranking) => ranking.apiId)).toEqual([
      "openweathermap-data-2-5-weather",
      "open-meteo-v1-forecast"
    ]);
    expect(rankings.map((ranking) => ranking.avgStarScore)).toEqual([5, 2]);
  });

  it("filters rankings by category", async () => {
    const store = createReportStore();

    await store.createReport(
      makeReport({
        category: "weather"
      })
    );
    await store.createReport(
      makeReport({
        provider: "CoinDesk",
        endpoint: "/v1/bpi/currentprice.json",
        category: "data",
        taskType: "price-check",
        timestamp: "2026-03-28T18:00:00Z"
      })
    );

    const rankings = await store.listRankings({ category: "weather" });

    expect(rankings).toEqual([
      expect.objectContaining({
        apiId: "open-meteo-v1-forecast",
        category: "weather",
        reviewCount: 1
      })
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

  it("returns API detail aggregates with reviews ordered newest first", async () => {
    const store = createReportStore();

    await store.createReport(
      makeReport({
        latencyMs: 280,
        starScore: 5,
        timestamp: "2026-03-28T16:00:00Z",
        comment: "Fast and consistent forecast data.",
        sourceType: "agent",
        agentName: "codex"
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

    const detail = await store.getApiDetail("open-meteo-v1-forecast");

    expect(detail).toEqual({
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
      reviews: [
        expect.objectContaining({
          timestamp: "2026-03-28T18:00:00Z",
          starScore: 3,
          success: false
        }),
        expect.objectContaining({
          timestamp: "2026-03-28T17:00:00Z",
          starScore: 4,
          rateLimited: true
        }),
        expect.objectContaining({
          timestamp: "2026-03-28T16:00:00Z",
          comment: "Fast and consistent forecast data.",
          sourceType: "agent",
          agentName: "codex"
        })
      ]
    });
  });

  it("returns seeded API detail data when a seeded API has no submitted reports", async () => {
    const store = createReportStore();

    await expect(store.getApiDetail("open-meteo-v1-forecast")).resolves.toEqual({
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
  });

  it("returns null for missing API detail", async () => {
    const store = createReportStore();

    await expect(store.getApiDetail("missing-api")).resolves.toBeNull();
  });
});

describe("supabase-backed report store", () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };

  beforeEach(() => {
    mockSupabaseReports.length = 0;
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = originalEnv.SUPABASE_ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("aggregates rankings from Supabase report rows", async () => {
    mockSupabaseReports.push(
      makeReport({
        latencyMs: 280,
        starScore: 5,
        timestamp: "2026-03-28T16:00:00Z",
        taskType: "daily-forecast"
      }),
      makeReport({
        latencyMs: 450,
        starScore: 4,
        timestamp: "2026-03-28T17:00:00Z",
        taskType: "daily-forecast",
        rateLimited: true
      }),
      makeReport({
        provider: "OpenWeatherMap",
        endpoint: "/data/2.5/weather",
        latencyMs: 320,
        starScore: 3,
        timestamp: "2026-03-28T18:00:00Z",
        taskType: "hourly-forecast"
      })
    );

    const store = createReportStore();
    const rankings = await store.listRankings({
      category: "weather",
      taskType: "daily-forecast"
    });

    expect(rankings).toEqual([
      {
        apiId: "open-meteo-v1-forecast",
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        avgStarScore: 4.5,
        reviewCount: 2,
        successRate: 1,
        medianLatencyMs: 365,
        rateLimitedCount: 1
      }
    ]);
  });
});
