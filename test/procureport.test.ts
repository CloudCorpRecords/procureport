import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  API_SERVICES,
  businessTypeCode,
  callApiWithPaginationSupport,
  callProcurementStatisticsApi,
  callProductListApi,
  callPublicDataStandardApi,
  callShoppingMallApi,
  crawlList,
  getAllApiServicesInfo,
  getApiOperations,
  getDataExplorationGuide,
  getDetailedAttributes,
  getProcurementStatisticsByYear,
  getRecentBidAnnouncements,
  getServerInfo,
  getSuccessfulBidsByBusinessType,
  resolveBaseUrl,
  resolveServiceKey,
  searchShoppingMallProducts,
} from "../src/procureport.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

interface Captured {
  urls: string[];
  method?: string;
}

function fakeFetch(captured: Captured, body: unknown = {}): FetchFn {
  return async (url: string, init?: { method?: string }) => {
    captured.urls.push(url);
    captured.method = init?.method;
    return jsonResponse(body);
  };
}

const BASE = "https://apis.data.go.kr";
const KEY = "test-service-key";

describe("base URL and service key resolution", () => {
  it("defaults and strips trailing slashes; blank key is undefined", () => {
    assert.equal(resolveBaseUrl(undefined), BASE);
    assert.equal(resolveBaseUrl("  "), BASE);
    assert.equal(resolveBaseUrl("https://example.test/api/"), "https://example.test/api");
    assert.equal(resolveServiceKey(undefined), undefined);
    assert.equal(resolveServiceKey("  "), undefined);
    assert.equal(resolveServiceKey(" abc "), "abc");
  });
});

describe("local catalogue tools work with no key", () => {
  it("server_info lists all 15 tools and the 4 services", () => {
    const info = getServerInfo(undefined) as {
      name: string;
      version: string;
      service_key_configured: boolean;
      tools: string[];
      services: Array<{ id: string; operations: number }>;
    };
    assert.equal(info.name, "procureport");
    assert.equal(info.version, "0.1.0");
    assert.equal(info.service_key_configured, false);
    assert.equal(info.tools.length, 15);
    assert.equal(info.services.length, 4);
    const withKey = getServerInfo(KEY) as { service_key_configured: boolean };
    assert.equal(withKey.service_key_configured, true);
  });

  it("catalogue operation counts match the public spec (14 / 12 / 9)", () => {
    const all = getAllApiServicesInfo() as {
      services: Array<{ id: string; operation_count: number; operations: string[] }>;
    };
    const byId = new Map(all.services.map((s) => [s.id, s]));
    assert.equal(byId.get("procurement_statistics")?.operation_count, 14);
    assert.equal(byId.get("product_list")?.operation_count, 12);
    assert.equal(byId.get("shopping_mall")?.operation_count, 9);
    assert.ok(byId.get("public_data_standard"));
    for (const s of API_SERVICES) assert.equal(s.operations.length, byId.get(s.id)?.operation_count);
  });

  it("get_api_operations resolves ids and names, and rejects unknown services", () => {
    const ops = getApiOperations({ service: "shopping_mall" }) as {
      service: string;
      operation_count: number;
    };
    assert.equal(ops.operation_count, 9);
    const byName = getApiOperations({ service: "Product List API" }) as { service: string };
    assert.equal(byName.service, "product_list");
    assert.throws(() => getApiOperations({ service: "nope" }), /unknown service/);
    assert.throws(() => getApiOperations({ service: " " }), /non-empty/);
  });

  it("exploration guide names the services and the business-type map", () => {
    const guide = getDataExplorationGuide() as {
      guide: string[];
      services: string[];
      business_types: Record<string, string>;
    };
    assert.ok(guide.guide.length >= 5);
    assert.equal(guide.services.length, 4);
    assert.equal(guide.business_types["물품"], "goods");
  });
});

describe("missing-key errors happen before any request", () => {
  it("generic call, crawl, and search all fail cleanly with no fetch", async () => {
    let calls = 0;
    const spy: FetchFn = async () => {
      calls += 1;
      return jsonResponse({});
    };
    await assert.rejects(
      () => callPublicDataStandardApi(spy, BASE, undefined, { operation: "get_bid_announcements" }),
      /NARAMARKET_SERVICE_KEY is required/,
    );
    await assert.rejects(() => crawlList(spy, BASE, " ", {}), /NARAMARKET_SERVICE_KEY is required/);
    await assert.rejects(
      () => searchShoppingMallProducts(spy, BASE, undefined, { query: "desk" }),
      /NARAMARKET_SERVICE_KEY is required/,
    );
    await assert.rejects(
      () => getDetailedAttributes(spy, BASE, undefined, { product_id: "P-1" }),
      /NARAMARKET_SERVICE_KEY is required/,
    );
    await assert.rejects(
      () =>
        callApiWithPaginationSupport(spy, BASE, undefined, {
          service: "product_list",
          operation: "get_product_list",
        }),
      /NARAMARKET_SERVICE_KEY is required/,
    );
    assert.equal(calls, 0);
  });
});

describe("request shaping", () => {
  it("generic call builds {base}/{service}/{operation} with serviceKey and params", async () => {
    const c: Captured = { urls: [] };
    await callPublicDataStandardApi(fakeFetch(c, { rows: [] }), BASE, KEY, {
      operation: "get_bid_announcements",
      params: { region: "Seoul", page: 2 },
    });
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/public_data_standard/get_bid_announcements");
    assert.equal(url.searchParams.get("serviceKey"), KEY);
    assert.equal(url.searchParams.get("region"), "Seoul");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(c.method, "GET");
  });

  it("each generic call_* tool targets its own service", async () => {
    const c: Captured = { urls: [] };
    const f = fakeFetch(c, {});
    await callProcurementStatisticsApi(f, BASE, KEY, { operation: "get_total_procurement_statistics" });
    await callProductListApi(f, BASE, KEY, { operation: "get_product_list" });
    await callShoppingMallApi(f, BASE, KEY, { operation: "get_shopping_mall_products" });
    assert.ok(c.urls[0].includes("/procurement_statistics/"));
    assert.ok(c.urls[1].includes("/product_list/"));
    assert.ok(c.urls[2].includes("/shopping_mall/"));
  });

  it("crawl_list passes query and paging to the product list operation", async () => {
    const c: Captured = { urls: [] };
    await crawlList(fakeFetch(c, []), BASE, KEY, { query: "chair", page: 3, page_size: 20 });
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/product_list/get_product_list");
    assert.equal(url.searchParams.get("query"), "chair");
    assert.equal(url.searchParams.get("page"), "3");
    assert.equal(url.searchParams.get("page_size"), "20");
  });

  it("get_detailed_attributes sends the product id", async () => {
    const c: Captured = { urls: [] };
    await getDetailedAttributes(fakeFetch(c, {}), BASE, KEY, { product_id: "PRD-42" });
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/product_list/get_product_detailed_attributes");
    assert.equal(url.searchParams.get("product_id"), "PRD-42");
  });

  it("search_shopping_mall_products sends query and optional company", async () => {
    const c: Captured = { urls: [] };
    await searchShoppingMallProducts(fakeFetch(c, {}), BASE, KEY, {
      query: "monitor",
      company: "Acme",
    });
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/shopping_mall/search_shopping_products");
    assert.equal(url.searchParams.get("query"), "monitor");
    assert.equal(url.searchParams.get("company"), "Acme");
  });

  it("a custom base URL is honoured", async () => {
    const c: Captured = { urls: [] };
    await crawlList(fakeFetch(c, {}), "https://example.test/api/", KEY, {});
    assert.ok(c.urls[0].startsWith("https://example.test/api/product_list/"));
  });
});

describe("convenience tools", () => {
  it("business type conversion maps Korean names and passes codes through", () => {
    assert.equal(businessTypeCode("물품"), "goods");
    assert.equal(businessTypeCode("용역"), "services");
    assert.equal(businessTypeCode("공사"), "construction");
    assert.equal(businessTypeCode("외자"), "foreign");
    assert.equal(businessTypeCode("goods"), "goods");
    assert.equal(businessTypeCode("custom-code"), "custom-code");
  });

  it("successful bids convert the Korean name and keep the original", async () => {
    const c: Captured = { urls: [] };
    await getSuccessfulBidsByBusinessType(fakeFetch(c, {}), BASE, KEY, { business_type: "공사" });
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/public_data_standard/get_successful_bids");
    assert.equal(url.searchParams.get("business_type"), "construction");
    assert.equal(url.searchParams.get("business_type_name"), "공사");
  });

  it("recent bids compute an auto period ending today and convert the type", async () => {
    const c: Captured = { urls: [] };
    const now = new Date(2026, 9, 26); // 2026-10-26 local
    await getRecentBidAnnouncements(fakeFetch(c, {}), BASE, KEY, { days: 7, business_type: "물품" }, now);
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/public_data_standard/get_bid_announcements");
    assert.equal(url.searchParams.get("end_date"), "20261026");
    assert.equal(url.searchParams.get("start_date"), "20261019");
    assert.equal(url.searchParams.get("business_type"), "goods");
  });

  it("recent bids reject a non-positive days value before any request", async () => {
    let calls = 0;
    const spy: FetchFn = async () => {
      calls += 1;
      return jsonResponse({});
    };
    await assert.rejects(
      () => getRecentBidAnnouncements(spy, BASE, KEY, { days: 0 }),
      /positive number/,
    );
    assert.equal(calls, 0);
  });

  it("statistics by year sends the year and validates it", async () => {
    const c: Captured = { urls: [] };
    await getProcurementStatisticsByYear(fakeFetch(c, {}), BASE, KEY, { year: 2025 });
    const url = new URL(c.urls[0]);
    assert.equal(url.pathname, "/procurement_statistics/get_statistics_by_year");
    assert.equal(url.searchParams.get("year"), "2025");
    await assert.rejects(
      () => getProcurementStatisticsByYear(fakeFetch({ urls: [] }, {}), BASE, KEY, { year: 2025.5 }),
      /integer between 1900 and 2100/,
    );
  });
});

describe("pagination support", () => {
  it("loops pages until a short page, aggregating items", async () => {
    const pages: Record<string, unknown[]> = {
      "1": [{ id: 1 }, { id: 2 }],
      "2": [{ id: 3 }, { id: 4 }],
      "3": [{ id: 5 }],
    };
    const seen: string[] = [];
    const paged: FetchFn = async (url: string) => {
      seen.push(url);
      const page = new URL(url).searchParams.get("page") ?? "1";
      return jsonResponse({ items: pages[page] ?? [] });
    };
    const out = await callApiWithPaginationSupport(paged, BASE, KEY, {
      service: "product_list",
      operation: "get_product_list",
      page_size: 2,
      max_pages: 10,
    });
    assert.equal(out.pages_fetched, 3);
    assert.equal(out.total_items, 5);
    assert.equal(seen.length, 3);
    assert.equal(new URL(seen[1]).searchParams.get("page_size"), "2");
  });

  it("stops at max_pages even when pages stay full", async () => {
    const paged: FetchFn = async () => jsonResponse([{ id: 1 }, { id: 2 }]);
    const out = await callApiWithPaginationSupport(paged, BASE, KEY, {
      service: "shopping_mall",
      operation: "get_shopping_mall_products",
      page_size: 2,
      max_pages: 3,
    });
    assert.equal(out.pages_fetched, 3);
    assert.equal(out.total_items, 6);
  });

  it("rejects an unknown service before any request", async () => {
    let calls = 0;
    const spy: FetchFn = async () => {
      calls += 1;
      return jsonResponse({});
    };
    await assert.rejects(
      () =>
        callApiWithPaginationSupport(spy, BASE, KEY, { service: "nope", operation: "x" }),
      /unknown service/,
    );
    assert.equal(calls, 0);
  });
});

describe("validation and HTTP errors", () => {
  it("empty operation / query / product_id are rejected", async () => {
    const f = fakeFetch({ urls: [] }, {});
    await assert.rejects(
      () => callShoppingMallApi(f, BASE, KEY, { operation: " " }),
      /operation must be a non-empty string/,
    );
    await assert.rejects(
      () => searchShoppingMallProducts(f, BASE, KEY, { query: "" }),
      /query must be a non-empty string/,
    );
    await assert.rejects(
      () => getDetailedAttributes(f, BASE, KEY, { product_id: "" }),
      /product_id must be a non-empty string/,
    );
  });

  it("HTTP 500 surfaces status and upstream message", async () => {
    const failing: FetchFn = async () => jsonResponse({ message: "bad key" }, 500, "Server Error");
    await assert.rejects(() => crawlList(failing, BASE, KEY, {}), /HTTP 500.*bad key/);
  });

  it("network failure is wrapped with context", async () => {
    const failing: FetchFn = async () => {
      throw new Error("socket hang up");
    };
    await assert.rejects(() => crawlList(failing, BASE, KEY, {}), /Procurement API request failed: socket hang up/);
  });
});
