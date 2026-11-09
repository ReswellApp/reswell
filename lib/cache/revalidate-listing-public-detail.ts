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
 * Expire one concrete `/l/...` URL.
 *
 * A second `"page"` argument writes a `/l/slug/page` tag. That tag is never
 * attached to `app/l/[listing]`. The hourly ISR shell is tagged with the
 * concrete URL, so the type argument left the previous listing on screen
 * until the hour elapsed.
 */
function revalidateConcreteListingPath(path: string): void {
  const trimmed = path.trim()
  if (!trimmed.startsWith("/l/")) return
  revalidatePath(trimmed)
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
  revalidateConcreteListingPath(primary)

  if (trimmedSlug !== "" && trimmedId !== "") {
    revalidateConcreteListingPath(`/l/${trimmedId}`)
  }

  expireListingPublicDetailParams([trimmedId, trimmedSlug])
}
