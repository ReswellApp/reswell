/**
 * Elasticsearch is optional. We only treat it as “configured” when the URL is set **and**
 * credentials are present (or anonymous access is explicitly allowed for local dev).
 *
 * A URL alone is not enough for Elastic Cloud / most secured clusters — without auth the
 * client would hit `security_exception` on every search.
 */
export const ELASTICSEARCH_LISTINGS_INDEX =
  process.env.ELASTICSEARCH_LISTINGS_INDEX || "reswell_listings"

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
