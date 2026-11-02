/**
 * procureport MCP server. Tools: crawl_list,
 * get_detailed_attributes, server_info,
 * call_public_data_standard_api, call_procurement_statistics_api,
 * call_product_list_api, call_shopping_mall_api,
 * get_recent_bid_announcements,
 * get_successful_bids_by_business_type,
 * get_procurement_statistics_by_year,
 * search_shopping_mall_products, get_all_api_services_info,
 * get_api_operations, call_api_with_pagination_support,
 * get_data_exploration_guide.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys that
 * are not in this tool's public spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod still
 * validates every tools/call argument set.
 *
 * The four catalogue/guide tools are local and need no key. Every
 * API-calling tool requires NARAMARKET_SERVICE_KEY; the API base
 * URL is read from NARAMARKET_API_URL at call time and defaults to
 * https://apis.data.go.kr.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  BASE_URL_ENV,
  callApiWithPaginationSupport,
  callProcurementStatisticsApi,
  callProductListApi,
  callPublicDataStandardApi,
  callShoppingMallApi,
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

const NoArgs = z.object({});
const CrawlListArgs = z.object({
  query: z.string().optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
});
const DetailedAttributesArgs = z.object({ product_id: z.string() });
const GenericCallArgs = z.object({
  operation: z.string(),
  params: z.record(z.unknown()).optional(),
});
const RecentBidsArgs = z.object({
  days: z.number().optional(),
  business_type: z.string().optional(),
});
const SuccessfulBidsArgs = z.object({ business_type: z.string() });
const StatisticsYearArgs = z.object({ year: z.number() });
const SearchMallArgs = z.object({
  query: z.string(),
  company: z.string().optional(),
});
const ApiOperationsArgs = z.object({ service: z.string() });
const PaginationArgs = z.object({
  service: z.string(),
  operation: z.string(),
  params: z.record(z.unknown()).optional(),
  max_pages: z.number().optional(),
  page_size: z.number().optional(),
});

const TOOLS = [
  {
    name: "crawl_list",
    description: "Query the product list, optionally filtered by a search query, with paging.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query text to filter the product list." },
        page: { type: "number", description: "Page number to return." },
        page_size: { type: "number", description: "Number of items per page." },
      },
    },
  },
  {
    name: "get_detailed_attributes",
    description: "Fetch the detailed attributes for a single product by its product identifier.",
    inputSchema: {
      type: "object" as const,
      properties: { product_id: { type: "string", description: "Product identifier." } },
      required: ["product_id"],
    },
  },
  {
    name: "server_info",
    description: "Return information about this server and the tools it offers, without calling the upstream API.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "call_public_data_standard_api",
    description: "Call the public data standard API for bid notices, awards, and contracts with an operation and parameters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        operation: { type: "string", description: "Operation name to call on the public data standard API." },
        params: { type: "object", description: "Additional parameters to pass to the operation." },
      },
      required: ["operation"],
    },
  },
  {
    name: "call_procurement_statistics_api",
    description: "Call the procurement statistics API (14 operations) with an operation and parameters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        operation: { type: "string", description: "Operation name to call on the procurement statistics API." },
        params: { type: "object", description: "Additional parameters to pass to the operation." },
      },
      required: ["operation"],
    },
  },
  {
    name: "call_product_list_api",
    description: "Call the product list API (12 operations) for the product catalogue with an operation and parameters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        operation: { type: "string", description: "Operation name to call on the product list API." },
        params: { type: "object", description: "Additional parameters to pass to the operation." },
      },
      required: ["operation"],
    },
  },
  {
    name: "call_shopping_mall_api",
    description: "Call the shopping mall API (9 operations) with an operation and parameters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        operation: { type: "string", description: "Operation name to call on the shopping mall API." },
        params: { type: "object", description: "Additional parameters to pass to the operation." },
      },
      required: ["operation"],
    },
  },
  {
    name: "get_recent_bid_announcements",
    description: "Get recent bid announcements over an automatically computed recent period, optionally for one business type.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of recent days to include, defaults to 7." },
        business_type: { type: "string", description: "Business type name or code, such as goods, services, construction, or foreign." },
      },
    },
  },
  {
    name: "get_successful_bids_by_business_type",
    description: "Get successful bids (awards) for a business type; a Korean business-type name is converted to its code automatically.",
    inputSchema: {
      type: "object" as const,
      properties: { business_type: { type: "string", description: "Business type name or code, such as goods, services, construction, or foreign." } },
      required: ["business_type"],
    },
  },
  {
    name: "get_procurement_statistics_by_year",
    description: "Get procurement statistics for a single year.",
    inputSchema: {
      type: "object" as const,
      properties: { year: { type: "number", description: "Year to get statistics for, as an integer between 1900 and 2100." } },
      required: ["year"],
    },
  },
  {
    name: "search_shopping_mall_products",
    description: "Search shopping mall products by name, optionally narrowed to one company.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Product name to search for." },
        company: { type: "string", description: "Company name to narrow results to." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_all_api_services_info",
    description: "List all API services and their operations from the built-in catalogue, without calling the upstream API.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_api_operations",
    description: "List the operations available for one API service from the built-in catalogue.",
    inputSchema: {
      type: "object" as const,
      properties: { service: { type: "string", description: "API service ID, such as public_data_standard, procurement_statistics, product_list, or shopping_mall." } },
      required: ["service"],
    },
  },
  {
    name: "call_api_with_pagination_support",
    description: "Call any service operation repeatedly with paging and aggregate the items across pages for bulk exploration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        service: { type: "string", description: "API service ID, such as public_data_standard, procurement_statistics, product_list, or shopping_mall." },
        operation: { type: "string", description: "Operation name to call." },
        params: { type: "object", description: "Additional parameters to pass to the operation." },
        max_pages: { type: "number", description: "Maximum number of pages to fetch, defaults to 5." },
        page_size: { type: "number", description: "Number of items per page, defaults to 100." },
      },
      required: ["service", "operation"],
    },
  },
  {
    name: "get_data_exploration_guide",
    description: "Return a guide to exploring the procurement data: which services and tools to use, in what order.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "procureport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const baseUrl = resolveBaseUrl(process.env[BASE_URL_ENV]);
  const serviceKey = resolveServiceKey(process.env[SERVICE_KEY_ENV]);
  try {
    let out: unknown;
    if (name === "crawl_list") {
      out = await crawlList(fetchFn, baseUrl, serviceKey, CrawlListArgs.parse(args ?? {}));
    } else if (name === "get_detailed_attributes") {
      out = await getDetailedAttributes(fetchFn, baseUrl, serviceKey, DetailedAttributesArgs.parse(args ?? {}));
    } else if (name === "server_info") {
      NoArgs.parse(args ?? {});
      out = getServerInfo(serviceKey);
    } else if (name === "call_public_data_standard_api") {
      out = await callPublicDataStandardApi(fetchFn, baseUrl, serviceKey, GenericCallArgs.parse(args ?? {}));
    } else if (name === "call_procurement_statistics_api") {
      out = await callProcurementStatisticsApi(fetchFn, baseUrl, serviceKey, GenericCallArgs.parse(args ?? {}));
    } else if (name === "call_product_list_api") {
      out = await callProductListApi(fetchFn, baseUrl, serviceKey, GenericCallArgs.parse(args ?? {}));
    } else if (name === "call_shopping_mall_api") {
      out = await callShoppingMallApi(fetchFn, baseUrl, serviceKey, GenericCallArgs.parse(args ?? {}));
    } else if (name === "get_recent_bid_announcements") {
      out = await getRecentBidAnnouncements(fetchFn, baseUrl, serviceKey, RecentBidsArgs.parse(args ?? {}));
    } else if (name === "get_successful_bids_by_business_type") {
      out = await getSuccessfulBidsByBusinessType(fetchFn, baseUrl, serviceKey, SuccessfulBidsArgs.parse(args ?? {}));
    } else if (name === "get_procurement_statistics_by_year") {
      out = await getProcurementStatisticsByYear(fetchFn, baseUrl, serviceKey, StatisticsYearArgs.parse(args ?? {}));
    } else if (name === "search_shopping_mall_products") {
      out = await searchShoppingMallProducts(fetchFn, baseUrl, serviceKey, SearchMallArgs.parse(args ?? {}));
    } else if (name === "get_all_api_services_info") {
      NoArgs.parse(args ?? {});
      out = getAllApiServicesInfo();
    } else if (name === "get_api_operations") {
      out = getApiOperations(ApiOperationsArgs.parse(args ?? {}));
    } else if (name === "call_api_with_pagination_support") {
      out = await callApiWithPaginationSupport(fetchFn, baseUrl, serviceKey, PaginationArgs.parse(args ?? {}));
    } else if (name === "get_data_exploration_guide") {
      NoArgs.parse(args ?? {});
      out = getDataExplorationGuide();
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
