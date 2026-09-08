import { revalidatePath, revalidateTag } from "next/cache"
import {
  LISTING_PUBLIC_DETAIL_CACHE_TAG,
  listingPublicDetailCacheTag,
} from "@/lib/cache/listing-public-detail"
import { listingDetailHref } from "@/lib/listing-href"

const EXPIRE_NOW = { expire: 0 } as const

/** SWR bust of every listing-detail Data Cache entry (browse/catalog-wide mutations). */
export function revalidateListingPublicDetailCatalog(): void {
  revalidateTag(LISTING_PUBLIC_DETAIL_CACHE_TAG, "max")
}

function expireListingPublicDetailParams(params: Array<string | null | undefined>): void {
  const seen = new Set<string>()
  for (const raw of params) {
    const param = typeof raw === "string" ? raw.trim() : ""
    if (!param || seen.has(param)) continue
    seen.add(param)
    revalidateTag(listingPublicDetailCacheTag(param), EXPIRE_NOW)
  }
}

/**
 * Invalidate `/l/[listing]` after publish, sold, hide, or vacation.
 * Hard-expires this listing's Data Cache so a hide cannot re-bake a public PDP
 * from a stale `hidden_from_site: false` row. Does not bust the global catalog tag.
 */
export function revalidateListingDetailPage(listingId: string, slug?: string | null): void {
  const trimmedId = listingId.trim()
  const trimmedSlug = typeof slug === "string" ? slug.trim() : ""
  const primary = listingDetailHref({
    id: trimmedId,
    slug: trimmedSlug || undefined,
  })
  revalidatePath(primary, "page")

  if (trimmedSlug !== "") {
    revalidatePath(`/l/${trimmedId}`, "page")
  }

  expireListingPublicDetailParams([trimmedId, trimmedSlug])
}
