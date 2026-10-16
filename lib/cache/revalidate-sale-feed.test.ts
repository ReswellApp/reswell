import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  isPublicMarketplaceHtmlPath,
  publicMarketplaceCdnCacheControl,
} from "../crawler/public-marketplace-paths.ts"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("sale feed invalidation", () => {
  it("expires the sale feed data cache and the /sale route together", () => {
    const src = readRepo("lib/cache/revalidate-sale-feed.ts")
    assert.match(src, /expire:\s*0/)
    assert.match(src, /revalidatePath\("\/sale", "page"\)/)
    assert.match(src, /revalidatePath\("\/sale", "layout"\)/)
    assert.doesNotMatch(src, /["']max["']/)
  })

  it("refills /sale from the primary and leaves CDN caching to on-demand revalidation", () => {
    const cache = readRepo("lib/cache/sale-feed.ts")
    assert.match(cache, /consistency:\s*"strong"/)
    assert.doesNotMatch(cache, /consistency:\s*"eventual"/)
    assert.equal(isPublicMarketplaceHtmlPath("/sale"), true)
    assert.equal(publicMarketplaceCdnCacheControl("/sale", false), null)
  })

  it("runs that bust after a markdown, a price drop, a sale, and a hide", () => {
    assert.match(
      readRepo("lib/services/listingQuickPrice.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
    assert.match(
      readRepo("lib/services/listingAutoPriceDrop.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
    assert.match(
      readRepo("lib/services/listingMarkSold.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
    assert.match(readRepo("lib/services/listingEnd.ts"), /revalidateSaleFeedCatalog\(\)/)
    assert.match(
      readRepo("lib/cache/safe-revalidate-after-order.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
    assert.match(
      readRepo("lib/services/listingSiteModerationRevalidation.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
    assert.match(
      readRepo("lib/cache/revalidate-listing-after-edit.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
    assert.match(
      readRepo("app/api/wallet/purchase/route.ts"),
      /revalidateSaleFeedCatalog\(\)/,
    )
  })
})
