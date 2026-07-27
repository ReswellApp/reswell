/**
 * Elasticsearch is optional. We only treat it as “configured” when the URL is set **and**
 * credentials are present (or anonymous access is explicitly allowed for local dev).
 *
 * A URL alone is not enough for Elastic Cloud / most secured clusters — without auth the
 * client would hit `security_exception` on every search.
 */
export const ELASTICSEARCH_LISTINGS_INDEX =
  process.env.ELASTICSEARCH_LISTINGS_INDEX || "reswell_listings"

export const ELASTICSEARCH_BRANDS_INDEX =
  process.env.ELASTICSEARCH_BRANDS_INDEX || "reswell_brands"

/** Fin brand/model/variant catalog for `/sell/fins` jumpstart search. */
export const ELASTICSEARCH_FIN_CATALOG_INDEX =
  process.env.ELASTICSEARCH_FIN_CATALOG_INDEX || "reswell_fin_catalog"

export const ELASTICSEARCH_FORUM_THREADS_INDEX =
  process.env.ELASTICSEARCH_FORUM_THREADS_INDEX || "reswell_forum_threads"

/** Append-only marketplace search events for admin analytics (trending queries, volume, zero-result rate). */
export const ELASTICSEARCH_SEARCH_ANALYTICS_INDEX =
  process.env.ELASTICSEARCH_SEARCH_ANALYTICS_INDEX || "reswell_search_analytics"

/** Nav/sell-form typeahead picks (which dropdown row types users choose, ES vs DB pipeline). */
export const ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX =
  process.env.ELASTICSEARCH_SEARCH_SUGGEST_ANALYTICS_INDEX || "reswell_search_suggest_analytics"

function hasElasticsearchAuth(): boolean {
  const apiKey = process.env.ELASTICSEARCH_API_KEY?.trim()
  if (apiKey) return true
  const u = process.env.ELASTICSEARCH_USERNAME?.trim()
  const p = process.env.ELASTICSEARCH_PASSWORD?.trim()
  return Boolean(u && p)
}

/** Local / dev cluster with security disabled — set `ELASTICSEARCH_ALLOW_ANONYMOUS=true`. */
function elasticsearchAnonymousAllowed(): boolean {
  return process.env.ELASTICSEARCH_ALLOW_ANONYMOUS === "true"
}

export function isElasticsearchConfigured(): boolean {
  const url = process.env.ELASTICSEARCH_URL?.trim()
  if (!url) return false
  return hasElasticsearchAuth() || elasticsearchAnonymousAllowed()
}
