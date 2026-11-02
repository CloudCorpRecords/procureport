#!/usr/bin/env node
/**
 * procureport CLI.
 *
 *   procureport server-info
 *   procureport services
 *   procureport operations <service>
 *   procureport guide
 *   procureport crawl [query] [--page N] [--page-size N]
 *   procureport attributes <product-id>
 *   procureport recent-bids [--days N] [--business-type NAME]
 *   procureport successful-bids <business-type>
 *   procureport statistics-year <year>
 *   procureport search-mall <query> [--company NAME]
 *   procureport mcp
 *
 * API commands need NARAMARKET_SERVICE_KEY. Base URL from
 * NARAMARKET_API_URL, default https://apis.data.go.kr. The four
 * catalogue commands (server-info, services, operations, guide)
 * work with nothing configured.
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
import {
  BASE_URL_ENV,
  crawlList,
  formatPayload,
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
  SERVICE_KEY_ENV,
  VERSION,
} from "./procureport.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  procureport server-info
  procureport services
  procureport operations <service>
  procureport guide
  procureport crawl [query] [--page N] [--page-size N]
  procureport attributes <product-id>
  procureport recent-bids [--days N] [--business-type NAME]
  procureport successful-bids <business-type>
  procureport statistics-year <year>
  procureport search-mall <query> [--company NAME]
  procureport mcp
  procureport --version`);
  process.exit(2);
}

function flag(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

function positional(rest: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i].startsWith("--")) {
      i += 1;
    } else {
      out.push(rest[i]);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const baseUrl = resolveBaseUrl(process.env[BASE_URL_ENV]);
  const serviceKey = resolveServiceKey(process.env[SERVICE_KEY_ENV]);
  const known = [
    "server-info",
    "services",
    "operations",
    "guide",
    "crawl",
    "attributes",
    "recent-bids",
    "successful-bids",
    "statistics-year",
    "search-mall",
  ];
  if (!known.includes(cmd)) usage();
  try {
    let out: unknown;
    const pos = positional(rest);
    if (cmd === "server-info") {
      out = getServerInfo(serviceKey);
    } else if (cmd === "services") {
      out = getAllApiServicesInfo();
    } else if (cmd === "operations") {
      if (!pos[0]) usage();
      out = getApiOperations({ service: pos[0] });
    } else if (cmd === "guide") {
      out = getDataExplorationGuide();
    } else if (cmd === "crawl") {
      const page = flag(rest, "--page");
      const pageSize = flag(rest, "--page-size");
      out = await crawlList(fetchFn, baseUrl, serviceKey, {
        query: pos[0],
        page: page !== undefined ? Number(page) : undefined,
        page_size: pageSize !== undefined ? Number(pageSize) : undefined,
      });
    } else if (cmd === "attributes") {
      if (!pos[0]) usage();
      out = await getDetailedAttributes(fetchFn, baseUrl, serviceKey, { product_id: pos[0] });
    } else if (cmd === "recent-bids") {
      const days = flag(rest, "--days");
      out = await getRecentBidAnnouncements(fetchFn, baseUrl, serviceKey, {
        days: days !== undefined ? Number(days) : undefined,
        business_type: flag(rest, "--business-type"),
      });
    } else if (cmd === "successful-bids") {
      if (!pos[0]) usage();
      out = await getSuccessfulBidsByBusinessType(fetchFn, baseUrl, serviceKey, {
        business_type: pos[0],
      });
    } else if (cmd === "statistics-year") {
      if (!pos[0]) usage();
      out = await getProcurementStatisticsByYear(fetchFn, baseUrl, serviceKey, {
        year: Number(pos[0]),
      });
    } else {
      if (!pos[0]) usage();
      out = await searchShoppingMallProducts(fetchFn, baseUrl, serviceKey, {
        query: pos[0],
        company: flag(rest, "--company"),
      });
    }
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
