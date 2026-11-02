# procureport — Build Report

MCP Rebuild 1000, Tranche Batch 4 (builder 7 of 8). Clean-room
rebuild of alphago2580/naramarketmcp (candidate
ai.smithery/alphago2580-naramarketmcp, rank 150, 4 stars, tier C),
built from the public README spec captured in
`harness/fixtures/naramarketmcp-tools-original.json`. That fixture
is docs-derived: the 15 tools are the full documented set (README
in Korean; tool names in English) and the argument schemas are
documented reconstructions — no original server was probed. Parity
proves the rebuild matches this program's defined spec, labelled
docs-derived. Local build only — nothing pushed or published.

Identity: repo `procureport`, npm `@reneturcios/procureport`,
MCP name `io.github.CloudCorpRecords/procureport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `procureport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Korean public procurement: bids,
  awards, contracts, statistics, products and mall search." =
  **89 chars** (≤100 ✓); npm entry carries `version: 0.1.0`; OCI
  entry `ghcr.io/cloudcorprecords/procureport:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/procureport"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`server-info`, `services`,
  `operations`, `guide`, `crawl`, `attributes`, `recent-bids`,
  `successful-bids`, `statistics-year`, `search-mall`, `mcp`,
  `--version`; exit 2 usage / 1 API error), `src/mcp.ts`,
  `src/types.ts`, `src/procureport.ts` (core logic,
  `VERSION = "0.1.0"`)
- `test/procureport.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to procureport)

## Tools implemented (15)

Basic: `crawl_list`, `get_detailed_attributes`, `server_info`.
API: `call_public_data_standard_api`,
`call_procurement_statistics_api`, `call_product_list_api`,
`call_shopping_mall_api`. Convenience:
`get_recent_bid_announcements`,
`get_successful_bids_by_business_type`,
`get_procurement_statistics_by_year`,
`search_shopping_mall_products`. Exploration:
`get_all_api_services_info`, `get_api_operations`,
`call_api_with_pagination_support`, `get_data_exploration_guide`
— the full documented set, as recorded in the fixture `_source`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the defined spec
  and break exact schema parity. Zod still validates every
  `tools/call`.
- Schemas per spec: generic `call_*` tools take
  `{operation: string (required), params: object}`;
  `crawl_list {query, page, page_size}`;
  `search_shopping_mall_products {query (required), company}`;
  `get_recent_bid_announcements {days, business_type}`;
  `get_successful_bids_by_business_type {business_type (required)}`;
  `get_procurement_statistics_by_year {year (required)}`;
  `get_api_operations {service (required)}`;
  `call_api_with_pagination_support {service, operation (both
  required), params, max_pages, page_size}`;
  `get_detailed_attributes {product_id (required)}` (documented
  reconstruction — the task spec did not pin this one);
  `server_info` / `get_all_api_services_info` /
  `get_data_exploration_guide` take no params.
- Service key: `NARAMARKET_SERVICE_KEY` is required for every
  API-calling tool. A missing/blank key raises a clean error
  before any request is attempted (unit-tested with a spy fetch:
  zero calls). The four local tools — `server_info`,
  `get_all_api_services_info`, `get_api_operations`,
  `get_data_exploration_guide` — work with no key and no HTTP.
- Built-in catalogue of the 4 services backs the local tools:
  public-data standard (bid notices / awards / contracts, 9
  operations), procurement statistics (14 operations), product
  list (12 operations), shopping mall (9 operations). The counts
  follow the public spec; individual operation names are
  documented reconstructions (see Gaps).
- Request shaping: `GET {base}/{service}/{operation}` with
  `serviceKey` plus the flattened params as the query string,
  under the base URL from `NARAMARKET_API_URL` (default
  `https://apis.data.go.kr`, trailing slashes stripped).
  Non-scalar param values are JSON-encoded.
- Convenience tools: `get_recent_bid_announcements` computes a
  `start_date`/`end_date` window (YYYYMMDD) ending today from
  `days` (default 7); `get_successful_bids_by_business_type`
  converts Korean business-type names to codes (물품→goods,
  용역→services, 공사→construction, 외자→foreign; English aliases
  accepted, unknown values pass through) and keeps the original
  name alongside; `get_procurement_statistics_by_year` validates
  an integer year 1900–2100 before any request.
- `call_api_with_pagination_support` walks pages from 1, sending
  `page`/`page_size` (defaults: max 5 pages, 100 per page),
  extracts items from an array payload or an
  `items`/`results`/`data`/`rows`/`list` array field, and stops
  at the first short page or the page cap, returning
  `{service, operation, pages_fetched, total_items, items}`.
- HTTP failures surface the status plus the upstream `message` or
  `error` string when present.
- All HTTP flows through an injectable `FetchFn` (types.ts). The
  test suite uses a fake fetch returning hand-written fixtures;
  no live call is made in tests.

## Verification (foreground, exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced, including `dist/cli.js`.

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 23
ℹ pass 23
ℹ fail 0
```
Covers: base-URL default/custom/trailing-slash and service-key
resolution; local tools with no key (server_info's 15 tools / 4
services, catalogue counts 14/12/9, operations by id and by name,
unknown-service error, guide contents); missing-key errors for
generic/crawl/search/attributes/pagination tools with a spy fetch
proving zero requests; request shaping (serviceKey + params,
per-service paths for all four generic tools, crawl paging,
product-id, mall query+company, custom base); business-type
conversion (all four Korean names, code passthrough);
successful-bids shaping keeping the original name; recent-bids
auto period (injected clock: 2026-10-26 minus 7 days →
start 20261019, end 20261026) and non-positive-days rejection;
statistics-year shaping and fractional-year rejection; pagination
looping to a short page (3 pages, 5 items), stopping at max_pages
with full pages, and unknown-service rejection before any request;
empty operation/query/product_id validation; HTTP 500 surfacing
the upstream message; network failure wrapping.

### 3. CLI / MCP smoke
`--version` → `0.1.0` (exit 0); unknown command exits 2 with
Usage; `server-info` prints the server summary with
`service_key_configured: false` and no key configured (exit 0).
MCP `initialize` over stdio → `serverInfo:
{"name":"procureport","version":"0.1.0"}`; a stdio `tools/call`
for `get_api_operations` with `{service:"shopping_mall"}` returned
the 9-operation catalogue — a local path, so no live upstream
call was made in smoke and no live result is claimed.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/naramarketmcp-tools-original.json \
    --rebuild "stdio:node .../builds/procureport/dist/cli.js mcp" \
    --out .../builds/procureport/parity-out
verdict=PASS parity_pct=100.0 original_tools=15 rebuild_tools=15 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 15/15.) Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was generated clean via Route 3: a temp copy
(`/tmp/procureport-lock/`) holding only `package.json` (no
`node_modules`), offline
`npm install --package-lock-only --ignore-scripts`, verified after
generation — parses as JSON, top-level `name` is
`@reneturcios/procureport`, version `0.1.0`, `lockfileVersion` 3,
128 package entries — then only the lockfile was copied back.
Local `node_modules` is a sibling copy (fxrates) used only for
the local build/test; it is not part of the lockfile generation.

## Gaps / honest notes

- Docs-derived spec: the argument schemas are documented
  reconstructions from the public README, per the task spec — no
  original naramarketmcp server was probed, so parity proves the
  rebuild matches this program's defined spec, not a hand-probed
  original. `get_detailed_attributes`' `product_id` argument and
  `call_api_with_pagination_support`'s paging arguments are this
  rebuild's reconstructions where the spec did not pin them.
- Catalogue operation names are documented reconstructions: the
  public spec fixes the four services and the 14/12/9 operation
  counts for statistics/product-list/shopping-mall, but not every
  operation's exact upstream name; the public-data standard
  service's 9-operation list is likewise reconstructed around its
  documented bid-notice / award / contract areas.
- Endpoint shape (`{base}/{service}/{operation}?serviceKey=...`)
  is a data.go.kr-style reconstruction; no live call was made, so
  live path/parameter drift against the real Nara Market services
  (which in reality use per-service endpoint paths and Korean
  parameter names) is unverified until the publish wave.
- Business-type codes (goods/services/construction/foreign) are
  readable reconstructions of the upstream codes; the Korean
  name→code conversion behaviour itself is unit-tested.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
