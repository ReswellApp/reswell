import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { homeListingsSection, homePeerToMobileCard, homeShopToMobile } from "./mobileHomeMap.ts"

const LISTING_ID = "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d"

describe("mobile homepage map", () => {
  it("keeps a homepage peer card in the listing shape the app already renders", () => {
    const card = homePeerToMobileCard({
      id: LISTING_ID,
      slug: "album-twin",
      title: "album twin",
      price: "725.5",
      status: "active",
      section: "surfboards",
      condition: "good",
      board_type: "shortboard",
      shipping_available: true,
      local_pickup: false,
      listing_images: [{ url: "https://cdn.example.com/board.jpg", is_primary: true }],
    })
    if (!card) throw new Error("expected a card")
    assert.equal(card.title, "Album Twin")
    assert.equal(card.price_label, "$725.50")
    assert.equal(card.section, "surfboards")
    assert.equal(card.image_url, "https://cdn.example.com/board.jpg")
  })

  it("drops an empty listings section and keeps shop name ahead of a personal name", () => {
    assert.equal(homeListingsSection("recently_listed", "Recently listed", []), null)
    const shop = homeShopToMobile({
      id: LISTING_ID,
      seller_slug: "north-shop",
      display_name: "North",
      avatar_url: null,
      city: "Santa Cruz",
      location: null,
      is_shop: true,
      shop_name: "North Shop",
      shop_logo_url: null,
      shop_verified: true,
      shop_address: "123 Pacific Ave",
    })
    if (!shop) throw new Error("expected a shop")
    assert.equal(shop.name, "North Shop")
    assert.equal(shop.location_label, "123 Pacific Ave")
    assert.equal(shop.verified, true)
  })
})
