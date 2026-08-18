/**
 * Post-publish enrichment: which quick wins would make a live listing sell
 * faster? Pickup-only publishes often defer description, dimensions, and
 * shipping — these gaps drive the "make it sell faster" prompts on the
 * publish celebration card and the owner's PDP panel.
 */

export interface ListingEnrichmentGap {
  id: "description" | "photos" | "dimensions" | "shipping"
  label: string
}

export interface ListingEnrichmentInput {
  section: string
  description: string | null | undefined
  /** `listings.dimensions` display string (surfboards). */
  dimensions?: string | null
  shippingAvailable?: boolean | null
  photoCount: number
}

const ENRICHMENT_MIN_PHOTOS = 3

export function computeListingEnrichmentGaps(
  input: ListingEnrichmentInput,
): ListingEnrichmentGap[] {
  const gaps: ListingEnrichmentGap[] = []
  const isBoard = input.section === "surfboards"

  if (!input.description?.trim()) {
    gaps.push({ id: "description", label: "Add a description" })
  }
  if (input.photoCount > 0 && input.photoCount < ENRICHMENT_MIN_PHOTOS) {
    gaps.push({ id: "photos", label: "Add more photos" })
  }
  if (isBoard && !input.dimensions?.trim()) {
    gaps.push({ id: "dimensions", label: "Add dimensions" })
  }
  if (isBoard && input.shippingAvailable !== true) {
    gaps.push({ id: "shipping", label: "Offer shipping" })
  }

  return gaps.slice(0, 3)
}
