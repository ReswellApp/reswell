import {
  marketplaceBrandQueryCandidates,
  stripMarketplaceSearchNoiseWords,
} from "@/lib/utils/marketplace-brand-query"

/** Turn a listing URL slug into human-readable text for brand directory resolution. */
export function brandHintLabelFromListingSlug(slug: string): string {
  const normalized = slug.replace(/-/g, " ").trim()
  if (!normalized) return ""
  return stripMarketplaceSearchNoiseWords(normalized) || normalized
}

/** Candidate labels to resolve `public.brands` from a `/l/{slug}` when the row is gone. */
export function marketplaceBrandCandidatesFromListingSlug(slug: string): string[] {
  const label = brandHintLabelFromListingSlug(slug)
  if (!label) return []
  return marketplaceBrandQueryCandidates(label)
}
