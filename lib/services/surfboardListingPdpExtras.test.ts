import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { buyerAgreedPriceUsdFromOffer } from "./buyerAgreedPrice.ts"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8")
}

describe("buyerAgreedPriceUsdFromOffer", () => {
  it("uses the accepted amount when the seller matches", () => {
    assert.equal(
      buyerAgreedPriceUsdFromOffer({ seller_id: "seller", current_amount: "410.005" }, "seller"),
      410.01,
    )
  })

  it("ignores another seller's offer and non-positive amounts", () => {
    assert.equal(
      buyerAgreedPriceUsdFromOffer({ seller_id: "other", current_amount: "100" }, "seller"),
      null,
    )
    assert.equal(
      buyerAgreedPriceUsdFromOffer({ seller_id: "seller", current_amount: "0" }, "seller"),
      null,
    )
    assert.equal(buyerAgreedPriceUsdFromOffer(null, "seller"), null)
  })
})

describe("surfboard PDP hero stream", () => {
  it("shares one public listing loader between metadata and the route", () => {
    const cache = read("lib/cache/listing-public-detail.ts")
    assert.match(cache, /export const getCachedPublicListingDetail = cache\(/)
    assert.match(cache, /export const getCachedPublicListingForMetadata = getCachedPublicListingDetail/)
    assert.match(cache, /export const getCachedPublicListingForRoute = getCachedPublicListingDetail/)
    assert.match(cache, /export const getCachedPublicSurfboardListing = getCachedPublicListingDetail/)

    const page = read("app/l/[listing]/page.tsx")
    const metadataUsesSharedLoader = page.includes("await getCachedPublicListingDetail(listingParam)")
    assert.equal(metadataUsesSharedLoader, true)
    assert.equal(page.split("getCachedPublicListingDetail(listingParam)").length - 1, 2)
    assert.match(page, /getCachedLiveListingByParam/)
    assert.doesNotMatch(page, /getCachedPublicListingForMetadata/)
    assert.doesNotMatch(page, /getCachedPublicListingForRoute/)
  })

  it("keeps review and count reads off the anonymous hero and out of the session client", () => {
    const extras = read("lib/services/surfboardListingPdpExtras.ts")
    assert.doesNotMatch(extras, /getCachedRequestSession/)
    assert.doesNotMatch(extras, /next\/headers/)

    const page = read("components/surfboard-listing-detail-page.tsx")
    assert.match(page, /<ImageGallery/)
    assert.match(page, /<SurfboardListingSellerReviews/)
    assert.match(page, /<SurfboardListingPlatformRating/)
    assert.doesNotMatch(page, /loadSurfboardListingSocialProof/)
    assert.doesNotMatch(page, /loadSurfboardListingIdentity/)
    assert.doesNotMatch(page, /await Promise\.all/)
    assert.doesNotMatch(page, /getListingCartHolderCount/)
    assert.doesNotMatch(page, /getCachedSellerReviewSummary/)
    assert.doesNotMatch(page, /getBrandById/)
    assert.match(page, /if \(user\) \{[\s\S]*?const viewer = await loadSurfboardListingViewerState/)
    assert.match(
      read("components/features/listings/listing-detail-public-or-authenticated.tsx"),
      /anonymousPublicView:\s*true/,
    )
  })
})
