import type { PageSeoOverrideRow } from "@/lib/db/page-seo"
import { EMPTY_OVERRIDE, type PageSeoOverrideValues } from "@/lib/seo/types"

/** Map a stored row into the normalized override value shape (safe for client + server). */
export function mapOverrideRowToValues(row: PageSeoOverrideRow | null): PageSeoOverrideValues {
  if (!row) return EMPTY_OVERRIDE
  return {
    title: row.title,
    description: row.description,
    keywords: row.keywords,
    canonicalUrl: row.canonical_url,
    robotsIndex: row.robots_index,
    robotsFollow: row.robots_follow,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImageUrl: row.og_image_url,
    ogType: row.og_type,
    twitterCard: row.twitter_card,
    twitterTitle: row.twitter_title,
    twitterDescription: row.twitter_description,
    twitterImageUrl: row.twitter_image_url,
    structuredData: row.structured_data ?? null,
  }
}
