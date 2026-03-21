/** Elasticsearch is used when ELASTICSEARCH_URL is set (plus auth if your cluster requires it). */
export const ELASTICSEARCH_LISTINGS_INDEX =
  process.env.ELASTICSEARCH_LISTINGS_INDEX || "reswell_listings"

export function isElasticsearchConfigured(): boolean {
  return Boolean(process.env.ELASTICSEARCH_URL?.trim())
}
