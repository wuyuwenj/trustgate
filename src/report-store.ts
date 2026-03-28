import { createClient } from "@supabase/supabase-js";
import type { ParsedReport, ReportCategory } from "./reports.js";

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

  async listRankings(_filters: ReportListFilters): Promise<RankingEntry[]> {
    throw new Error("listRankings is not implemented");
  }

  async getApiDetail(_apiId: string): Promise<ApiDetail | null> {
    throw new Error("getApiDetail is not implemented");
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
