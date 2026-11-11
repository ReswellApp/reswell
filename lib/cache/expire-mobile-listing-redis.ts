import { redisDel } from "@/lib/redis/cache"
import { redisMobileListingCacheKeys } from "@/lib/redis/keys"

/**
 * Drop the mobile PDP + rails Redis shells for one listing.
 * Fire-and-forget so publish/sold/edit responses are not blocked on Upstash.
 */
export function expireMobileListingRedisCache(listingId: string, slug?: string | null): void {
  const keys = redisMobileListingCacheKeys(listingId, slug)
  void redisDel(keys).catch((error: unknown) => {
    console.error("[redis] listing expire failed", {
      listingId,
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
  })
}
