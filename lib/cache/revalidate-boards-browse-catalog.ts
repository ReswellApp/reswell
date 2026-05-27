import { revalidatePath, revalidateTag } from "next/cache"
import { BOARDS_BROWSE_CACHE_TAG } from "@/lib/cache/boards-browse-catalog"

/** Bust cached `/boards` category-type grids after publish, sold, or hide events. */
export function revalidateBoardsBrowseCatalog(): void {
  revalidateTag(BOARDS_BROWSE_CACHE_TAG)
  revalidatePath("/boards", "page")
}
