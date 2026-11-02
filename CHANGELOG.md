# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `procureport server-info|services|operations|guide|crawl|attributes|recent-bids|successful-bids|statistics-year|search-mall`
  and `procureport mcp`.
- MCP server (`procureport mcp`, stdio) with fifteen tools: the
  basic `crawl_list`, `get_detailed_attributes`, and `server_info`;
  the generic `call_public_data_standard_api`,
  `call_procurement_statistics_api`, `call_product_list_api`, and
  `call_shopping_mall_api`; the convenience
  `get_recent_bid_announcements`,
  `get_successful_bids_by_business_type`,
  `get_procurement_statistics_by_year`, and
  `search_shopping_mall_products`; and the exploration
  `get_all_api_services_info`, `get_api_operations`,
  `call_api_with_pagination_support`, and
  `get_data_exploration_guide`.
- API tools require `NARAMARKET_SERVICE_KEY` and fail cleanly
  before any request when it is missing; the four catalogue/guide
  tools are local and need no key.
- Calls go under the base URL from `NARAMARKET_API_URL`,
  defaulting to `https://apis.data.go.kr`, shaped as
  `{base}/{service}/{operation}?serviceKey=...`.
- Built-in catalogue of the four services with their operations
  (statistics 14, product list 12, shopping mall 9, plus the
  public-data standard service), and Korean business-type names
  converted to upstream codes automatically.
- HTTP failures surface the status plus the upstream `message` or
  `error` when present.
- All HTTP goes through an injectable fetch function, so the test
  suite runs entirely on hand-written fixtures with no network access.
