import type { ApiCategory, ApiDetailResponse, RankingsResponse } from "@/types";

export interface GetRankingsOptions {
  category: ApiCategory;
  taskType?: string;
  baseUrl?: string;
}

export interface GetApiDetailOptions {
  apiId: string;
  baseUrl?: string;
}

const defaultBackendBaseUrl =
  process.env.TRUSTGATE_BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_TRUSTGATE_BACKEND_BASE_URL ??
  "http://127.0.0.1:3000";

function buildRequestUrl(path: string, baseUrl?: string) {
  return new URL(path, baseUrl ?? defaultBackendBaseUrl).toString();
}

export async function getRankings({
  category,
  taskType,
  baseUrl
}: GetRankingsOptions): Promise<RankingsResponse> {
  const searchParams = new URLSearchParams({ category });

  if (taskType) {
    searchParams.set("taskType", taskType);
  }

  const response = await fetch(
    buildRequestUrl(`/rankings?${searchParams.toString()}`, baseUrl),
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load rankings (${response.status})`);
  }

  return (await response.json()) as RankingsResponse;
}

export async function getApiDetail({
  apiId,
  baseUrl
}: GetApiDetailOptions): Promise<ApiDetailResponse> {
  const response = await fetch(
    buildRequestUrl(`/apis/${encodeURIComponent(apiId)}`, baseUrl),
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load API detail (${response.status})`);
  }

  return (await response.json()) as ApiDetailResponse;
}
