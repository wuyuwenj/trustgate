import { describe, expect, it } from "vitest";
import { normalizeApiId, parseReportInput } from "../src/reports.js";

describe("report schema", () => {
  it("normalizes apiId from provider and endpoint", () => {
    expect(normalizeApiId("Open-Meteo", "/v1/forecast")).toBe(
      "open-meteo-v1-forecast"
    );
    expect(normalizeApiId("Anthropic", "v1/messages")).toBe(
      "anthropic-v1-messages"
    );
  });

  it("parses a valid report and returns apiId", () => {
    expect(
      parseReportInput({
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
      })
    ).toEqual(
      expect.objectContaining({
        apiId: "open-meteo-v1-forecast",
        category: "weather",
        starScore: 5
      })
    );
  });

  it("rejects reports outside the MVP constraints", () => {
    expect(() =>
      parseReportInput({
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "finance",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 412,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 6
      })
    ).toThrow();

    expect(() =>
      parseReportInput({
        provider: "Open-Meteo",
        endpoint: "/v1/forecast",
        category: "weather",
        taskType: "daily-forecast",
        success: true,
        latencyMs: 412,
        timestamp: "2026-03-28T17:00:00Z",
        starScore: 5,
        comment: "x".repeat(501)
      })
    ).toThrow();
  });
});
