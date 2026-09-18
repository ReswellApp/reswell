import { z } from "zod"
import {
  isListingSearchTagSlug,
  LISTING_SEARCH_TAG_MAX,
  normalizeListingSearchTag,
} from "@/lib/listing-search-tags"

export const listingSearchTagsBodySchema = z.object({
  search_tags: z
    .array(z.string())
    .max(LISTING_SEARCH_TAG_MAX)
    .transform((tags) => {
      const out: string[] = []
      const seen = new Set<string>()
      for (const raw of tags) {
        const slug = normalizeListingSearchTag(raw)
        if (!isListingSearchTagSlug(slug) || seen.has(slug)) continue
        seen.add(slug)
        out.push(slug)
      }
      return out
    }),
})
