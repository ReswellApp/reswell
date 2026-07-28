/** Peer listing sections indexed in Elasticsearch for marketplace search. */
export const ELASTICSEARCH_INDEXED_LISTING_SECTIONS = [
  "surfboards",
  "fins",
  "magazines",
  "wetsuits",
] as const

export type ElasticsearchIndexedListingSection =
  (typeof ELASTICSEARCH_INDEXED_LISTING_SECTIONS)[number]

const INDEXED_SECTION_SET = new Set<string>(ELASTICSEARCH_INDEXED_LISTING_SECTIONS)

export function isElasticsearchIndexedListingSection(section: string): boolean {
  return INDEXED_SECTION_SET.has(section)
}
