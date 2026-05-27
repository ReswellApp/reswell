import { revalidateTag } from "next/cache"
import { NAV_SUGGESTED_SURFBOARDS_CACHE_TAG } from "@/lib/cache/nav-suggested-surfboards"

/** Bust cached header nav suggested surfboard pools after listing visibility changes. */
export function revalidateNavSuggestedSurfboards(): void {
  revalidateTag(NAV_SUGGESTED_SURFBOARDS_CACHE_TAG)
}
