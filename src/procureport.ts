/**
 * procureport core: fifteen tools over the Korean public
 * procurement (Nara Market / data.go.kr style) APIs.
 *
 * Local tools (no service key, no HTTP):
 *   server_info, get_all_api_services_info, get_api_operations,
 *   get_data_exploration_guide — all answered from the built-in
 *   catalogue below.
 *
 * API tools (NARAMARKET_SERVICE_KEY required; a missing key is a
 * clean error raised before any request is attempted):
 *   crawl_list, get_detailed_attributes,
 *   call_public_data_standard_api, call_procurement_statistics_api,
 *   call_product_list_api, call_shopping_mall_api,
 *   get_recent_bid_announcements,
 *   get_successful_bids_by_business_type,
 *   get_procurement_statistics_by_year,
 *   search_shopping_mall_products,
 *   call_api_with_pagination_support.
 *
 * Calls are GET requests shaped as
 *   {base}/{service}/{operation}?serviceKey={key}&{params}
 * under the base URL from NARAMARKET_API_URL, defaulting to
 * https://apis.data.go.kr. All HTTP goes through an injected
 * FetchFn so everything is testable offline.
 *
 * The catalogue's operation counts follow the public spec:
 * procurement statistics 14 operations, product list 12,
 * shopping mall 9; the public-data standard service covers bid
 * notices, awards, and contracts. Individual operation names are
 * documented reconstructions, as labelled in the harness fixture.
 */
import type {
  ApiOperationsOptions,
  ApiServiceInfo,
  CrawlListOptions,
  DetailedAttributesOptions,
  FetchFn,
  GenericCallOptions,
  PaginationCallOptions,
  PaginatedResult,
  RecentBidAnnouncementsOptions,
  SearchMallOptions,
  StatisticsByYearOptions,
  SuccessfulBidsOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "https://apis.data.go.kr";

export const BASE_URL_ENV = "NARAMARKET_API_URL";

export const SERVICE_KEY_ENV = "NARAMARKET_SERVICE_KEY";

export const TOOL_NAMES = [
  "crawl_list",
  "get_detailed_attributes",
  "server_info",
  "call_public_data_standard_api",
  "call_procurement_statistics_api",
  "call_product_list_api",
  "call_shopping_mall_api",
  "get_recent_bid_announcements",
  "get_successful_bids_by_business_type",
  "get_procurement_statistics_by_year",
  "search_shopping_mall_products",
  "get_all_api_services_info",
  "get_api_operations",
  "call_api_with_pagination_support",
  "get_data_exploration_guide",
] as const;

/** Built-in catalogue of the four upstream services and their operations. */
export const API_SERVICES: ApiServiceInfo[] = [
  {
    id: "public_data_standard",
    name: "Public Data Standard API",
    description:
      "Bid notices, successful-bid (award) results, and contract records published under the public data standard.",
    operations: [
      "get_bid_announcements",
      "get_bid_announcement_detail",
      "get_successful_bids",
      "get_successful_bid_detail",
      "get_contract_info",
      "get_contract_detail",
      "get_bid_opening_results",
      "get_foreign_contract_info",
      "get_procurement_status",
    ],
  },
  {
    id: "procurement_statistics",
    name: "Procurement Statistics API",
    description:
      "Aggregate procurement statistics by period, business type, region, institution, and product category.",
    operations: [
      "get_total_procurement_statistics",
      "get_statistics_by_year",
      "get_statistics_by_month",
      "get_statistics_by_business_type",
      "get_statistics_by_region",
      "get_statistics_by_institution",
      "get_statistics_by_product_category",
      "get_statistics_by_company",
      "get_statistics_by_contract_method",
      "get_statistics_by_bid_type",
      "get_goods_statistics",
      "get_services_statistics",
      "get_construction_statistics",
      "get_foreign_statistics",
    ],
  },
  {
    id: "product_list",
    name: "Product List API",
    description:
      "The registered product catalogue: product search, detail and attribute lookups, and classification data.",
    operations: [
      "get_product_list",
      "get_product_detail",
      "get_product_detailed_attributes",
      "search_products_by_name",
      "search_products_by_company",
      "get_products_by_category",
      "get_products_by_region",
      "get_new_products",
      "get_updated_products",
      "get_product_classification",
      "get_cancelled_products",
      "get_product_registration_history",
    ],
  },
  {
    id: "shopping_mall",
    name: "Shopping Mall API",
    description:
      "Products listed on the public shopping mall, their contract and delivery information, and price history.",
    operations: [
      "get_shopping_mall_products",
      "search_shopping_products",
      "get_shopping_product_detail",
      "get_shopping_products_by_company",
      "get_shopping_products_by_category",
      "get_delivery_request_list",
      "get_shopping_contract_info",
      "get_shopping_product_price",
      "get_shopping_product_history",
    ],
  },
];

/**
 * Business-type name to code conversion. Korean names from the
 * public spec map to the codes the upstream services expect;
 * English aliases are accepted, and an already-coded value passes
 * through unchanged.
 */
export const BUSINESS_TYPE_CODES: Record<string, string> = {
  "물품": "goods",
  goods: "goods",
  products: "goods",
  "용역": "services",
  services: "services",
  service: "services",
  "공사": "construction",
  construction: "construction",
  works: "construction",
  "외자": "foreign",
  foreign: "foreign",
};

/** Convert a business-type name (Korean or English) to its upstream code. */
export function businessTypeCode(value: string): string {
  const v = requireNonEmpty(value, "business_type");
  return BUSINESS_TYPE_CODES[v] ?? BUSINESS_TYPE_CODES[v.toLowerCase()] ?? v;
}

/** Resolve the API base URL: env value when non-blank, else default. Trailing slashes are stripped. */
export function resolveBaseUrl(value?: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  const base = v ? v : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

/** Resolve the service key: the trimmed env value, or undefined when unset/blank. */
export function resolveServiceKey(value?: string): string | undefined {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : undefined;
}

function requireServiceKey(key?: string): string {
  const k = resolveServiceKey(key);
  if (!k) {
    throw new Error(
      `${SERVICE_KEY_ENV} is required for API-calling tools: set it to your data.go.kr service key`,
    );
  }
  return k;
}

function requireNonEmpty(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function optionalText(value: unknown): string | undefined {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findService(service: string): ApiServiceInfo {
  const v = requireNonEmpty(service, "service");
  const found = API_SERVICES.find(
    (s) =>
      s.id === v ||
      s.id === v.toLowerCase() ||
      s.name.toLowerCase() === v.toLowerCase(),
  );
  if (!found) {
    throw new Error(
      `unknown service: ${v} (available: ${API_SERVICES.map((s) => s.id).join(", ")})`,
    );
  }
  return found;
}

async function callApi(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  service: string,
  operation: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const key = requireServiceKey(serviceKey);
  const svc = findService(service);
  const op = requireNonEmpty(operation, "operation");
  const query = new URLSearchParams();
  query.set("serviceKey", key);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    query.set(k, isRecord(v) || Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  const url = `${resolveBaseUrl(baseUrl)}/${svc.id}/${op}?${query.toString()}`;
  let response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(
      `Procurement API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload)) {
        if (typeof payload.message === "string" && payload.message) {
          detail = `: ${payload.message}`;
        } else if (typeof payload.error === "string" && payload.error) {
          detail = `: ${payload.error}`;
        }
      }
    } catch {
      // A non-JSON error body still reports its HTTP status below.
    }
    throw new Error(
      `Procurement API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Procurement API returned a response that was not valid JSON");
  }
}

/** Shared implementation behind the four generic call_* tools. */
async function callGeneric(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  service: string,
  options: GenericCallOptions,
): Promise<unknown> {
  const operation = requireNonEmpty(options?.operation, "operation");
  const params = isRecord(options?.params) ? options.params : {};
  return callApi(fetchFn, baseUrl, serviceKey, service, operation, params);
}

// ---------------------------------------------------------------------------
// Local tools (no key, no HTTP)
// ---------------------------------------------------------------------------

/** server_info: this server's identity, its tools, and its services. */
export function getServerInfo(serviceKey?: string): unknown {
  return {
    name: "procureport",
    version: VERSION,
    service_key_configured: Boolean(resolveServiceKey(serviceKey)),
    service_key_env: SERVICE_KEY_ENV,
    base_url_env: BASE_URL_ENV,
    default_base_url: DEFAULT_BASE_URL,
    tools: [...TOOL_NAMES],
    services: API_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      operations: s.operations.length,
    })),
  };
}

/** get_all_api_services_info: the full built-in catalogue. */
export function getAllApiServicesInfo(): unknown {
  return {
    services: API_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      operation_count: s.operations.length,
      operations: [...s.operations],
    })),
  };
}

/** get_api_operations: the operations of one named service. */
export function getApiOperations(options: ApiOperationsOptions): unknown {
  const svc = findService(options?.service ?? "");
  return {
    service: svc.id,
    name: svc.name,
    operation_count: svc.operations.length,
    operations: [...svc.operations],
  };
}

/** get_data_exploration_guide: a strategy for exploring the data. */
export function getDataExplorationGuide(): unknown {
  return {
    guide: [
      "Start with get_all_api_services_info to see the four services and how many operations each exposes.",
      "Use get_api_operations with a service id to list that service's operations before calling it.",
      "Use the convenience tools first (recent bids, awards by business type, statistics by year, mall search); they fill in periods and convert Korean business-type names to codes for you.",
      "Drop to the generic call_* tools when you need a specific operation or parameter combination the convenience tools do not cover.",
      "For bulk pulls, use call_api_with_pagination_support: it walks pages until a short page or the page cap is reached.",
      "Statistics are annual-friendly: get_procurement_statistics_by_year is the fastest way to sanity-check totals before drilling into the 14 statistics operations.",
    ],
    services: API_SERVICES.map((s) => s.id),
    business_types: { ...BUSINESS_TYPE_CODES },
  };
}

// ---------------------------------------------------------------------------
// API tools (service key required)
// ---------------------------------------------------------------------------

/** crawl_list: query the product list with paging. */
export async function crawlList(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: CrawlListOptions = {},
): Promise<unknown> {
  const params: Record<string, unknown> = {};
  const query = optionalText(options.query);
  if (query) params.query = query;
  if (options.page !== undefined) params.page = options.page;
  if (options.page_size !== undefined) params.page_size = options.page_size;
  return callApi(fetchFn, baseUrl, serviceKey, "product_list", "get_product_list", params);
}

/** get_detailed_attributes: detailed attributes for one product. */
export async function getDetailedAttributes(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: DetailedAttributesOptions,
): Promise<unknown> {
  const productId = requireNonEmpty(options?.product_id, "product_id");
  return callApi(fetchFn, baseUrl, serviceKey, "product_list", "get_product_detailed_attributes", {
    product_id: productId,
  });
}

/** call_public_data_standard_api: bid notices, awards, and contracts. */
export async function callPublicDataStandardApi(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: GenericCallOptions,
): Promise<unknown> {
  return callGeneric(fetchFn, baseUrl, serviceKey, "public_data_standard", options);
}

/** call_procurement_statistics_api: procurement statistics (14 operations). */
export async function callProcurementStatisticsApi(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: GenericCallOptions,
): Promise<unknown> {
  return callGeneric(fetchFn, baseUrl, serviceKey, "procurement_statistics", options);
}

/** call_product_list_api: the product catalogue (12 operations). */
export async function callProductListApi(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: GenericCallOptions,
): Promise<unknown> {
  return callGeneric(fetchFn, baseUrl, serviceKey, "product_list", options);
}

/** call_shopping_mall_api: the shopping mall (9 operations). */
export async function callShoppingMallApi(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: GenericCallOptions,
): Promise<unknown> {
  return callGeneric(fetchFn, baseUrl, serviceKey, "shopping_mall", options);
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** get_recent_bid_announcements: bid notices over a recent auto-computed period. */
export async function getRecentBidAnnouncements(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: RecentBidAnnouncementsOptions = {},
  now: Date = new Date(),
): Promise<unknown> {
  const days = options.days !== undefined ? options.days : 7;
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
    throw new Error("days must be a positive number");
  }
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - Math.floor(days));
  const params: Record<string, unknown> = {
    days: Math.floor(days),
    start_date: formatYmd(start),
    end_date: formatYmd(end),
  };
  const bt = optionalText(options.business_type);
  if (bt) params.business_type = businessTypeCode(bt);
  return callApi(fetchFn, baseUrl, serviceKey, "public_data_standard", "get_bid_announcements", params);
}

/** get_successful_bids_by_business_type: awards, converting the Korean business-type name to its code. */
export async function getSuccessfulBidsByBusinessType(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: SuccessfulBidsOptions,
): Promise<unknown> {
  const original = requireNonEmpty(options?.business_type, "business_type");
  return callApi(fetchFn, baseUrl, serviceKey, "public_data_standard", "get_successful_bids", {
    business_type: businessTypeCode(original),
    business_type_name: original,
  });
}

/** get_procurement_statistics_by_year: statistics for one year. */
export async function getProcurementStatisticsByYear(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: StatisticsByYearOptions,
): Promise<unknown> {
  const year = options?.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error("year must be an integer between 1900 and 2100");
  }
  return callApi(fetchFn, baseUrl, serviceKey, "procurement_statistics", "get_statistics_by_year", {
    year,
  });
}

/** search_shopping_mall_products: mall products by name, optionally narrowed to a company. */
export async function searchShoppingMallProducts(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: SearchMallOptions,
): Promise<unknown> {
  const query = requireNonEmpty(options?.query, "query");
  const params: Record<string, unknown> = { query };
  const company = optionalText(options.company);
  if (company) params.company = company;
  return callApi(fetchFn, baseUrl, serviceKey, "shopping_mall", "search_shopping_products", params);
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) {
    for (const key of ["items", "results", "data", "rows", "list"]) {
      const v = payload[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

/** call_api_with_pagination_support: walk pages of any operation and aggregate the items. */
export async function callApiWithPaginationSupport(
  fetchFn: FetchFn,
  baseUrl: string | undefined,
  serviceKey: string | undefined,
  options: PaginationCallOptions,
): Promise<PaginatedResult> {
  const svc = findService(options?.service ?? "");
  const operation = requireNonEmpty(options?.operation, "operation");
  const maxPages = options.max_pages !== undefined ? options.max_pages : 5;
  if (typeof maxPages !== "number" || !Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error("max_pages must be a positive integer");
  }
  const pageSize = options.page_size !== undefined ? options.page_size : 100;
  if (typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("page_size must be a positive integer");
  }
  const baseParams = isRecord(options.params) ? options.params : {};
  const items: unknown[] = [];
  let pagesFetched = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await callApi(fetchFn, baseUrl, serviceKey, svc.id, operation, {
      ...baseParams,
      page,
      page_size: pageSize,
    });
    pagesFetched += 1;
    const pageItems = extractItems(payload);
    items.push(...pageItems);
    if (pageItems.length < pageSize) break;
  }
  return {
    service: svc.id,
    operation,
    pages_fetched: pagesFetched,
    total_items: items.length,
    items,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
