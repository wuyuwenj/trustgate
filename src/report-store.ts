import { createClient } from "@supabase/supabase-js";
import type { ParsedReport } from "./reports.js";

export type StoredReport = ParsedReport;

export interface ReportStore {
  createReport(report: ParsedReport): Promise<StoredReport>;
}

class InMemoryReportStore implements ReportStore {
  private readonly reports: StoredReport[] = [];

  async createReport(report: ParsedReport) {
    this.reports.push(report);
    return report;
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
    }
  };
}
