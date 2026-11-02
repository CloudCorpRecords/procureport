/**
 * procureport types.
 *
 * The upstream is the Korean public-procurement (Nara Market /
 * data.go.kr style) API family: four services covering bid notices,
 * awards and contracts, procurement statistics, the product
 * catalogue, and the shopping mall. Calls carry a service key as a
 * query parameter. HTTP access is described by a minimal response
 * surface so tests can inject a fake fetch and never touch the
 * network.
 */

export interface GenericCallOptions {
  operation: string;
  params?: Record<string, unknown>;
}

export interface CrawlListOptions {
  query?: string;
  page?: number;
  page_size?: number;
}

export interface DetailedAttributesOptions {
  product_id: string;
}

export interface RecentBidAnnouncementsOptions {
  days?: number;
  business_type?: string;
}

export interface SuccessfulBidsOptions {
  business_type: string;
}

export interface StatisticsByYearOptions {
  year: number;
}

export interface SearchMallOptions {
  query: string;
  company?: string;
}

export interface ApiOperationsOptions {
  service: string;
}

export interface PaginationCallOptions {
  service: string;
  operation: string;
  params?: Record<string, unknown>;
  max_pages?: number;
  page_size?: number;
}

/** One upstream API service in the built-in catalogue. */
export interface ApiServiceInfo {
  id: string;
  name: string;
  description: string;
  operations: string[];
}

/** Aggregated result of the pagination helper. */
export interface PaginatedResult {
  service: string;
  operation: string;
  pages_fetched: number;
  total_items: number;
  items: unknown[];
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
