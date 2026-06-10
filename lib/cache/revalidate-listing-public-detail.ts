import { revalidatePath, revalidateTag } from "next/cache"
import { LISTING_PUBLIC_DETAIL_CACHE_TAG } from "@/lib/cache/listing-public-detail"
import { listingDetailHref } from "@/lib/listing-href"

/** Bust hourly anonymous listing detail cache after publish, sold, or hide events. */
export function revalidateListingPublicDetailCatalog(): void {
  revalidateTag(LISTING_PUBLIC_DETAIL_CACHE_TAG, 'max')
}

/** Invalidate `/l/[listing]` RSC payload and hourly listing detail cache after a mutation. */
export function revalidateListingDetailPage(listingId: string, slug?: string | null): void {
  const primary = listingDetailHref({
    id: listingId,
    slug: slug ?? undefined,
  })
  revalidatePath(primary, "page")

  const trimmed = typeof slug === "string" ? slug.trim() : ""
  if (trimmed !== "") {
    revalidatePath(`/l/${listingId}`, "page")
  }

  revalidateListingPublicDetailCatalog()
}
