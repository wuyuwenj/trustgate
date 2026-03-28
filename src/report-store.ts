import { createClient } from "@supabase/supabase-js";
import type { ParsedReport, ReportCategory } from "./reports.js";
import { listSeededApiRecordsByCategory } from "./seeded-apis.js";

export type StoredReport = ParsedReport;
export interface ReportListFilters {
  category: ReportCategory;
  taskType?: string;
}

export interface RankingEntry {
  apiId: string;
  provider: string;
  endpoint: string;
  category: ReportCategory;
  avgStarScore: number;
  reviewCount: number;
  successRate: number;
  medianLatencyMs: number;
  rateLimitedCount: number;
}

export interface ApiDetail {
  api: {
    apiId: string;
    provider: string;
    endpoint: string;
    category: ReportCategory;
    avgStarScore: number;
    reviewCount: number;
    successRate: number;
    medianLatencyMs: number;
    rateLimitedCount: number;
  };
  reviews: StoredReport[];
}

export interface ReportStore {
  createReport(report: ParsedReport): Promise<StoredReport>;
  listReports(filters: ReportListFilters): Promise<StoredReport[]>;
  listRankings(filters: ReportListFilters): Promise<RankingEntry[]>;
  getApiDetail(apiId: string): Promise<ApiDetail | null>;
  listReportsByApiId(apiId: string): Promise<StoredReport[]>;
}

function calculateMedian(values: number[]) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[midpoint]!;
  }

  return (sortedValues[midpoint - 1]! + sortedValues[midpoint]!) / 2;
}

class InMemoryReportStore implements ReportStore {
  private readonly reports: StoredReport[] = [];

  async createReport(report: ParsedReport) {
    this.reports.push(report);
    return report;
  }

  async listReports(filters: ReportListFilters) {
    return this.reports.filter(
      (report) =>
        report.category === filters.category &&
        (filters.taskType === undefined || report.taskType === filters.taskType)
    );
  }

  async listRankings(filters: ReportListFilters): Promise<RankingEntry[]> {
    if (this.reports.length === 0) {
      return listSeededApiRecordsByCategory(filters.category).map((record) => ({
        apiId: record.apiId,
        provider: record.provider,
        endpoint: record.endpoint,
        category: record.category,
        avgStarScore: 0,
        reviewCount: 0,
        successRate: 0,
        medianLatencyMs: 0,
        rateLimitedCount: 0
      }));
    }

    const reports = await this.listReports(filters);
    const rankings = new Map<
      string,
      {
        apiId: string;
        provider: string;
        endpoint: string;
        category: ReportCategory;
        starScoreTotal: number;
        reviewCount: number;
        successCount: number;
        latencies: number[];
        rateLimitedCount: number;
      }
    >();

    for (const report of reports) {
      const existing = rankings.get(report.apiId);

      if (existing) {
        existing.starScoreTotal += report.starScore;
        existing.reviewCount += 1;
        existing.successCount += report.success ? 1 : 0;
        existing.latencies.push(report.latencyMs);
        existing.rateLimitedCount += report.rateLimited ? 1 : 0;
        continue;
      }

      rankings.set(report.apiId, {
        apiId: report.apiId,
        provider: report.provider,
        endpoint: report.endpoint,
        category: report.category,
        starScoreTotal: report.starScore,
        reviewCount: 1,
        successCount: report.success ? 1 : 0,
        latencies: [report.latencyMs],
        rateLimitedCount: report.rateLimited ? 1 : 0
      });
    }

    return Array.from(rankings.values())
      .map((ranking) => ({
        apiId: ranking.apiId,
        provider: ranking.provider,
        endpoint: ranking.endpoint,
        category: ranking.category,
        avgStarScore: ranking.starScoreTotal / ranking.reviewCount,
        reviewCount: ranking.reviewCount,
        successRate: ranking.successCount / ranking.reviewCount,
        medianLatencyMs: calculateMedian(ranking.latencies),
        rateLimitedCount: ranking.rateLimitedCount
      }))
      .sort(
        (left, right) =>
          right.avgStarScore - left.avgStarScore ||
          right.reviewCount - left.reviewCount ||
          left.apiId.localeCompare(right.apiId)
      );
  }

  async getApiDetail(_apiId: string): Promise<ApiDetail | null> {
    const reports = await this.listReportsByApiId(_apiId);

    if (reports.length === 0) {
      return null;
    }

    const [firstReport] = reports;
    let starScoreTotal = 0;
    let successCount = 0;
    let rateLimitedCount = 0;
    const latencies: number[] = [];

    for (const report of reports) {
      starScoreTotal += report.starScore;
      successCount += report.success ? 1 : 0;
      rateLimitedCount += report.rateLimited ? 1 : 0;
      latencies.push(report.latencyMs);
    }

    return {
      api: {
        apiId: firstReport.apiId,
        provider: firstReport.provider,
        endpoint: firstReport.endpoint,
        category: firstReport.category,
        avgStarScore: starScoreTotal / reports.length,
        reviewCount: reports.length,
        successRate: successCount / reports.length,
        medianLatencyMs: calculateMedian(latencies),
        rateLimitedCount
      },
      reviews: [...reports].sort((left, right) =>
        right.timestamp.localeCompare(left.timestamp)
      )
    };
  }

  async listReportsByApiId(apiId: string) {
    return this.reports.filter((report) => report.apiId === apiId);
  }
}

export function createReportStore(): ReportStore {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new InMemoryReportStore();
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  return {
    async createReport(report) {
      const { data, error } = await supabase
        .from("reports")
        .insert(report)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as StoredReport;
    },
    async listReports(filters) {
      let query = supabase
        .from("reports")
        .select("*")
        .eq("category", filters.category);

      if (filters.taskType !== undefined) {
        query = query.eq("taskType", filters.taskType);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []) as StoredReport[];
    },
    async listRankings(_filters): Promise<RankingEntry[]> {
      throw new Error("listRankings is not implemented");
    },
    async getApiDetail(_apiId): Promise<ApiDetail | null> {
      throw new Error("getApiDetail is not implemented");
    },
    async listReportsByApiId(apiId) {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("apiId", apiId);

      if (error) {
        throw error;
      }

      return (data ?? []) as StoredReport[];
    }
  };
}
