import { revalidatePath, revalidateTag } from "next/cache"
import { BOARDS_BROWSE_CACHE_TAG } from "@/lib/cache/boards-browse-catalog"
import { revalidateListingPublicDetailCatalog } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateMarketplaceSearch } from "@/lib/cache/revalidate-marketplace-search"
import { revalidateTopCitiesDirectory } from "@/lib/cache/revalidate-top-cities-directory"
import { revalidatePriceGuide } from "@/lib/cache/revalidate-price-guide"

/** Bust cached `/boards` category-type grids after publish, sold, or hide events. */
export function revalidateBoardsBrowseCatalog(): void {
  revalidateTag(BOARDS_BROWSE_CACHE_TAG, 'max')
  revalidateListingPublicDetailCatalog()
  revalidateTopCitiesDirectory()
  revalidatePriceGuide()
  revalidateMarketplaceSearch()
  revalidatePath("/boards", "page")
}
