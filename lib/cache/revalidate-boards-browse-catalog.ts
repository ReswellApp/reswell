import { revalidatePath, revalidateTag } from "next/cache"
import { BOARDS_BROWSE_CACHE_TAG } from "@/lib/cache/boards-browse-catalog"
import { revalidateListingPublicDetailCatalog } from "@/lib/cache/revalidate-listing-public-detail"

/** Bust cached `/boards` category-type grids after publish, sold, or hide events. */
export function revalidateBoardsBrowseCatalog(): void {
  revalidateTag(BOARDS_BROWSE_CACHE_TAG, 'max')
  revalidateListingPublicDetailCatalog()
  revalidatePath("/boards", "page")
}
