import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { deriveSellerDirectoryDisplayBanners } from "./directory-display-banners.ts"

describe("deriveSellerDirectoryDisplayBanners", () => {
  it("shows the lowest offer floor across active inventory", () => {
    const banners = deriveSellerDirectoryDisplayBanners([
      {
        buyer_offers_enabled: true,
        price: 100,
        minimum_offer_amount: 75,
      },
      {
        buyer_offers_enabled: true,
        price: 40,
        minimum_offer_pct: 70,
      },
    ])
    assert.deepEqual(banners, [{ kind: "offer", label: "Accepts offers · $28 min" }])
  })

  it("omits offer banner when every listing disables offers", () => {
    const banners = deriveSellerDirectoryDisplayBanners([
      { buyer_offers_enabled: false, price: 50 },
    ])
    assert.deepEqual(banners, [])
  })

  it("can add a shipping promo when room remains", () => {
    const banners = deriveSellerDirectoryDisplayBanners(
      [{ buyer_offers_enabled: true, price: 20, minimum_offer_pct: 70 }],
      { offersShipping: true },
    )
    assert.equal(banners.length, 2)
    assert.equal(banners[0]?.kind, "offer")
    assert.equal(banners[1]?.label, "Seller offers shipping")
  })
})
