# procureport

procureport opens up Korean public-procurement data — the Nara
Market / data.go.kr API family — through one binary that serves a
command-line interface and a stdio MCP server. It covers bid
notices, successful bids (awards) and contracts, procurement
statistics, the registered product catalogue, and the public
shopping mall.

## Configuration

API-calling tools need a service key:

```bash
export NARAMARKET_SERVICE_KEY=<your data.go.kr service key>
```

Calls go to data.go.kr-style endpoints under a base URL you can
override with `NARAMARKET_API_URL` (default
`https://apis.data.go.kr`). Requests are shaped as
`{base}/{service}/{operation}?serviceKey={key}&{params}`.

Four tools are purely local — they answer from a built-in
catalogue of the four API services and their operations, and work
with nothing configured: `server_info`,
`get_all_api_services_info`, `get_api_operations`, and
`get_data_exploration_guide`. Every other tool checks for the
service key first and fails with a clean error before any request
is attempted when it is missing.

## Install

```bash
npx @reneturcios/procureport server-info
```

Or run the container image:

```bash
docker run -i -e NARAMARKET_SERVICE_KEY=... ghcr.io/cloudcorprecords/procureport
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

```bash
procureport server-info
procureport services
procureport operations shopping_mall
procureport guide
procureport crawl chair --page 1 --page-size 20
procureport attributes PRD-42
procureport recent-bids --days 7 --business-type 물품
procureport successful-bids 공사
procureport statistics-year 2025
procureport search-mall monitor --company Acme

procureport --version
```

Exit codes: `0` on success, `1` when a call fails (including a
missing service key or an upstream API error), `2` for usage
errors.

## MCP server

```bash
npx -y @reneturcios/procureport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "procureport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/procureport", "mcp"],
      "env": { "NARAMARKET_SERVICE_KEY": "<your data.go.kr service key>" }
    }
  }
}
```

### Tools

Basic:

| Tool | Input | What it returns |
| --- | --- | --- |
| `crawl_list` | `query` (optional), `page`, `page_size` (optional) | A page of the product list. |
| `get_detailed_attributes` | `product_id` (required) | The detailed attributes of one product. |
| `server_info` | (none) | Server identity, tool list, and service summary. Local. |

Generic API access (each takes `operation` (required) and an
optional `params` object):

| Tool | Service |
| --- | --- |
| `call_public_data_standard_api` | Bid notices, awards, and contracts. |
| `call_procurement_statistics_api` | Procurement statistics — 14 operations. |
| `call_product_list_api` | Product catalogue — 12 operations. |
| `call_shopping_mall_api` | Shopping mall — 9 operations. |

Convenience:

| Tool | Input | What it returns |
| --- | --- | --- |
| `get_recent_bid_announcements` | `days`, `business_type` (both optional) | Bid notices over an automatically computed recent period. |
| `get_successful_bids_by_business_type` | `business_type` (required) | Awards for a business type; a Korean name such as 물품, 용역, 공사 or 외자 is converted to its code automatically. |
| `get_procurement_statistics_by_year` | `year` (required) | Procurement statistics for one year. |
| `search_shopping_mall_products` | `query` (required), `company` (optional) | Shopping-mall products matching a name, optionally narrowed to one company. |

Exploration:

| Tool | Input | What it returns |
| --- | --- | --- |
| `get_all_api_services_info` | (none) | All four services with their operations. Local. |
| `get_api_operations` | `service` (required) | The operations of one service. Local. |
| `call_api_with_pagination_support` | `service`, `operation` (required), `params`, `max_pages`, `page_size` (optional) | Items aggregated across pages until a short page or the page cap. |
| `get_data_exploration_guide` | (none) | A strategy guide for exploring the data. Local. |

Argument schemas in this rebuild are documented reconstructions
from the public README of the original server (tool names and
descriptions are documented; the README does not publish full
schemas). The built-in catalogue's service operation counts follow
the public spec (statistics 14, product list 12, shopping mall 9);
individual operation names within the catalogue are documented
reconstructions too.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
