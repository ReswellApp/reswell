import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL } from "../crawler/public-marketplace-cache-policy.ts"
import {
  isPublicMarketplaceHtmlPath,
  publicMarketplaceCdnCacheControl,
} from "../crawler/public-marketplace-paths.ts"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("sold feed invalidation", () => {
  it("expires the sold feed data cache and the /sold route together", () => {
    const src = readRepo("lib/cache/revalidate-marketplace-sold-feed.ts")
    assert.match(src, /expire:\s*0/)
    assert.match(src, /revalidatePath\("\/sold"\)/)
    assert.match(src, /revalidatePath\("\/sold", "page"\)/)
    assert.match(src, /revalidatePath\("\/sold", "layout"\)/)
    assert.doesNotMatch(src, /["']max["']/)
    assert.match(readRepo("app/sold/page.tsx"), /export const dynamic = "force-dynamic"/)
    assert.doesNotMatch(readRepo("app/sold/page.tsx"), /export const revalidate = 3600/)
    assert.match(readRepo("app/sold/sold-page-client.tsx"), /router\.refresh\(\)/)
  })

  it("refills /sold from the primary and leaves the long edge window to other pages", () => {
    const cache = readRepo("lib/cache/marketplace-sold-feed.ts")
    assert.match(cache, /marketplace-sold-feed-v14/)
    assert.match(cache, /formatGmv\(/)
    assert.match(cache, /consistency:\s*"strong"/)
    assert.doesNotMatch(cache, /consistency:\s*"eventual"/)
    assert.equal(isPublicMarketplaceHtmlPath("/sold"), true)
    assert.equal(publicMarketplaceCdnCacheControl("/sold", false), null)
    assert.equal(
      publicMarketplaceCdnCacheControl("/boards", false),
      PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
    )
  })

  it("does not CDN-cache sold feed pagination", () => {
    const route = readRepo("app/api/feed/sold/route.ts")
    assert.match(route, /consistency:\s*"strong"/)
    assert.match(route, /private, no-store/)
    assert.doesNotMatch(route, /stale-while-revalidate/)
    const client = readRepo("app/sold/sold-page-client.tsx")
    assert.match(client, /cache:\s*"no-store"/)
  })

  it("expires the new-listings grid when a board is published", () => {
    const src = readRepo("lib/cache/revalidate-marketplace-sold-feed.ts")
    assert.match(src, /function revalidateMarketplaceNewListingsFeed/)
    assert.match(src, /MARKETPLACE_NEW_LISTINGS_FEED_CACHE_TAG/)
    assert.match(
      readRepo("lib/services/listingSiteModerationRevalidation.ts"),
      /revalidateMarketplaceNewListingsFeed\(\)/,
    )
    assert.match(
      readRepo("lib/services/publishImportListing.ts"),
      /revalidateMarketplaceNewListingsFeed\(\)/,
    )
    assert.match(readRepo("lib/services/listingEnd.ts"), /revalidateMarketplaceNewListingsFeed\(\)/)
    const cache = readRepo("lib/cache/marketplace-sold-feed.ts")
    assert.match(cache, /MARKETPLACE_NEW_LISTINGS_FEED_CACHE_TAG/)
    assert.match(cache, /marketplace-new-listings-feed-v4/)
  })

  it("runs that bust after a sale, a purchase, and a return", () => {
    assert.match(
      readRepo("lib/services/listingMarkSold.ts"),
      /revalidateMarketplaceSoldFeedCatalog\(\)/,
    )
    assert.match(
      readRepo("lib/services/reswellBucksCheckoutSideEffects.ts"),
      /safeRevalidateAfterMarketplaceOrderCommit\(/,
    )
    const orderRevalidate = readRepo("lib/cache/safe-revalidate-after-order.ts")
    assert.match(orderRevalidate, /revalidateSoldFeedAfterSale\(\)/)
    assert.match(orderRevalidate, /revalidateMarketplaceSoldFeedCatalog\(\)/)
    assert.match(
      readRepo("lib/stripe-complete-order.ts"),
      /revalidateSoldFeedAfterSale\(\)/,
    )
    assert.match(readRepo("lib/services/listingRelist.ts"), /revalidateRecentlySoldSurfaces\(\)/)
    assert.match(
      readRepo("lib/cache/revalidate-home-public-catalog.ts"),
      /revalidateMarketplaceSoldFeedCatalog\(\)/,
    )
  })
})
