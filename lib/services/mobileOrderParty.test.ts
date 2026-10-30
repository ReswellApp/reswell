import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { partyDisplayName, toMobileOrderParty } from "./mobileOrderParty.ts"

const USER_ID = "33333333-3333-4333-8333-333333333333"

describe("mobile order party", () => {
  it("uses shop name, logo, and verified for a shop profile", () => {
    const party = toMobileOrderParty(
      {
        id: USER_ID,
        display_name: "Chris",
        seller_slug: "chris-shop",
        avatar_url: "https://cdn.example.com/me.jpg",
        is_shop: true,
        shop_name: "Chris Shop",
        shop_logo_url: "https://cdn.example.com/logo.jpg",
        shop_verified: true,
      },
      { userId: USER_ID, following: true, ratingAverage: 4.8, reviewCount: 12 },
    )
    if (!party) throw new Error("expected party")
    assert.equal(party.name, "Chris Shop")
    assert.equal(party.seller_slug, "chris-shop")
    assert.equal(party.verified, true)
    assert.equal(party.following, true)
    assert.equal(party.rating_average, 4.8)
    assert.equal(party.review_count, 12)
    assert.match(party.avatar_url ?? "", /logo\.jpg/)
  })

  it("falls back to the personal name when the buyer is not a shop", () => {
    assert.equal(partyDisplayName({ display_name: "Chrisheijn", is_shop: false }, "Buyer"), "Chrisheijn")
    const party = toMobileOrderParty(
      {
        id: USER_ID,
        display_name: "Chrisheijn",
        seller_slug: null,
        avatar_url: null,
        is_shop: false,
        shop_name: null,
        shop_logo_url: null,
        shop_verified: false,
      },
      { userId: USER_ID, fallbackName: "Buyer", ratingAverage: 0, reviewCount: 0 },
    )
    if (!party) throw new Error("expected party")
    assert.equal(party.name, "Chrisheijn")
    assert.equal(party.verified, false)
    assert.equal(party.seller_slug, null)
    assert.equal(party.review_count, 0)
    assert.equal(party.following, undefined)
  })
})
