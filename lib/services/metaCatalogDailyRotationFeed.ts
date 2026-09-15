import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchMetaCatalogDailyRotationCandidates } from "@/lib/db/metaCatalogDailyRotationFeed"
import { isListingDiscoveryEligible } from "@/lib/listing-public-visibility"
import {
  isMetaCatalogEligibleListing,
  listingToMetaCatalogFeedItem,
  type MetaCatalogFeedContext,
  type MetaCatalogFeedItem,
} from "@/lib/meta/catalog-product"
import {
  META_CATALOG_DAILY_ROTATION_BUCKETS,
  META_CATALOG_DAILY_ROTATION_PER_BUCKET,
  META_CATALOG_DAILY_ROTATION_SECTIONS,
  metaCatalogDailyRotationPoolSize,
  type MetaCatalogDailyRotationBucketKey,
} from "@/lib/meta/daily-rotation-feed"
import {
  boardsBrowseDailyRotateSeed,
  pickRotatedListingIdsPreferringFresh,
} from "@/lib/utils/boards-browse-daily-rotate"
import { resolveMetaCatalogShopContext } from "@/lib/services/metaCatalogFeed"

export type MetaCatalogDailyRotationResult = {
  seed: string
  items: MetaCatalogFeedItem[]
  counts: Record<MetaCatalogDailyRotationBucketKey, number>
  listingIdsByBucket: Record<MetaCatalogDailyRotationBucketKey, string[]>
}

function emptyBucketMap(): Record<MetaCatalogDailyRotationBucketKey, string[]> {
  return {
    fins: [],
    traction: [],
    wetsuits: [],
    apparel: [],
    magazines: [],
    hayden_shop_boards: [],
  }
}

function emptyCountMap(): Record<MetaCatalogDailyRotationBucketKey, number> {
  return {
    fins: 0,
    traction: 0,
    wetsuits: 0,
    apparel: 0,
    magazines: 0,
    hayden_shop_boards: 0,
  }
}

/**
 * Build the 30-item (or fewer) daily Meta catalog: 5 per bucket, rotating each UTC day.
 */
export async function buildMetaCatalogDailyRotationFeed(
  supabase: SupabaseClient,
  nowMs = Date.now(),
): Promise<MetaCatalogDailyRotationResult> {
  const seed = boardsBrowseDailyRotateSeed(nowMs)
  const poolSize = metaCatalogDailyRotationPoolSize()
  const shopContext = await resolveMetaCatalogShopContext(supabase)
  const listingIdsByBucket = emptyBucketMap()
  const items: MetaCatalogFeedItem[] = []
  const seenIds = new Set<string>()

  for (const bucket of META_CATALOG_DAILY_ROTATION_BUCKETS) {
    const userId = bucket.haydenShopOnly ? shopContext.haydenShopUserId : undefined
    if (bucket.haydenShopOnly && !userId) {
      console.warn(
        "[meta] daily-rotation: Hayden shop user id unresolved — skipping hayden_shop_boards",
      )
    }

    const rows = await fetchMetaCatalogDailyRotationCandidates(supabase, {
      section: bucket.section,
      userId,
      limit: poolSize,
    })

    const eligible = rows.filter((row) => {
      if (seenIds.has(row.id)) return false
      if (
        !isListingDiscoveryEligible({
          status: row.status ?? "active",
          title: row.title,
          hidden_from_site: row.hidden_from_site,
        })
      ) {
        return false
      }
      return isMetaCatalogEligibleListing(row, META_CATALOG_DAILY_ROTATION_SECTIONS)
    })

    const pickedIds = pickRotatedListingIdsPreferringFresh(
      eligible.map((row) => row.id),
      `${seed}:${bucket.key}`,
      META_CATALOG_DAILY_ROTATION_PER_BUCKET,
    )
    const byId = new Map(eligible.map((row) => [row.id, row]))

    for (const id of pickedIds) {
      const row = byId.get(id)
      if (!row) continue
      const item = listingToMetaCatalogFeedItem(
        row,
        rotationFeedContext(shopContext, bucket.customLabel1),
        META_CATALOG_DAILY_ROTATION_SECTIONS,
      )
      if (!item) continue
      seenIds.add(id)
      listingIdsByBucket[bucket.key].push(id)
      items.push(item)
    }
  }

  const counts = emptyCountMap()
  for (const key of Object.keys(listingIdsByBucket) as MetaCatalogDailyRotationBucketKey[]) {
    counts[key] = listingIdsByBucket[key].length
  }

  return { seed, items, counts, listingIdsByBucket }
}

function rotationFeedContext(
  shopContext: MetaCatalogFeedContext,
  rotationBucketLabel: string,
): MetaCatalogFeedContext {
  return {
    ...shopContext,
    rotationBucketLabel,
  }
}
