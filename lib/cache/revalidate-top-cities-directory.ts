import { revalidatePath, revalidateTag } from "next/cache"
import { TOP_CITIES_DIRECTORY_CACHE_TAG } from "@/lib/cache/top-cities-directory"

/** Bust cached `/cities/top` listing counts after publish, sold, or hide events. */
export function revalidateTopCitiesDirectory(): void {
  revalidateTag(TOP_CITIES_DIRECTORY_CACHE_TAG, "max")
  revalidatePath("/cities/top", "page")
}
