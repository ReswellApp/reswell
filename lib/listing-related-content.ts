export const RELATED_CONTENT_KINDS = ["blog", "listing"] as const

export const LISTING_RELATED_CONTENT_CACHE_TAG = "listing-related-content"

export function listingRelatedContentCacheTag(listingId: string): string {
  return `${LISTING_RELATED_CONTENT_CACHE_TAG}:${listingId.trim()}`
}

export type RelatedContentKind = (typeof RELATED_CONTENT_KINDS)[number]

export type ListingRelatedContentCard = {
  id: string
  kind: RelatedContentKind
  href: string
  title: string
  imageUrl: string | null
  label: string
}

export function relatedContentKindLabel(kind: RelatedContentKind): string {
  return kind === "blog" ? "blog" : "listing"
}

export function firstBlogArticleImageUrl(
  blocks: Array<{ kind: string; url?: string | null }>,
): string | null {
  for (const block of blocks) {
    if (block.kind !== "image") continue
    const url = block.url?.trim()
    if (url) return url
  }
  return null
}

/** First marketplace listing embedded in the article (`listing` or `listing-image`). */
export function firstBlogListingEmbedRef(
  blocks: Array<{ kind: string; ref?: string | null }>,
): string | null {
  for (const block of blocks) {
    if (block.kind !== "listing" && block.kind !== "listing-image") continue
    const ref = block.ref?.trim()
    if (ref) return ref
  }
  return null
}

export function isRelatedBlogVisibleOnPdp(blog: { published: boolean }): boolean {
  return blog.published === true
}

export function isRelatedListingVisibleOnPdp(listing: {
  status: string | null
  hidden_from_site: boolean | null
}): boolean {
  return listing.status === "active" && listing.hidden_from_site !== true
}
