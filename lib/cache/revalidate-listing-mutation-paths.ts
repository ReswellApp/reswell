import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"

/**
 * Revalidate browse + listing PDP after the Server Action response is sent.
 * Inline `revalidatePath` keeps the action pending; combined with client
 * navigation to `/l/[listing]` that freezes the sell form on Save.
 *
 * Must expire the hourly listing Data Cache — `revalidatePath` alone can
 * regenerate `/l` from a stale `unstable_cache` price.
 */
export function revalidateListingMutationPaths(browsePath: string, slug: string): void {
  const trimmed = slug.trim()
  after(() => {
    revalidatePath(browsePath)
    if (trimmed) revalidateListingDetailPage(trimmed, trimmed)
  })
}
