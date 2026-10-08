import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileListingsQuerySchema } from "@reswell/api-contract"
import { toMobileListingCard, toMobileListingDetail } from "./mobileApi.ts"
import type { MobileListingRow } from "@/lib/db/mobile-listings"

const ROW: MobileListingRow = {
  id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
  slug: "album-twin",
  title: "  Album Twin  ",
  description: " Light use. ",
  status: "active",
  price: "725.5",
  condition: "good",
  section: "surfboards",
  brand: "Album",
  model: "Twin",
  board_type: "shortboard",
  dimensions: "5'10\"",
  city: "Santa Cruz",
  state: "CA",
  shipping_available: true,
  local_pickup: false,
  shipping_price: null,
  board_shipping_cost_mode: null,
  hidden_from_site: false,
  archived_at: null,
  listing_images: [
    { url: "https://cdn.example.com/full.jpg", thumbnail_url: "https://cdn.example.com/thumb.jpg", is_primary: true },
  ],
  profiles: { display_name: "North Shop", seller_slug: "north-shop" },
}

describe("mobile listings contract", () => {
  it("defaults a missing page query", () => {
    const parsed = mobileListingsQuerySchema.parse({})
    assert.deepEqual(parsed, { limit: 20, offset: 0 })
  })

  it("rejects a page that is too large", () => {
    const parsed = mobileListingsQuerySchema.safeParse({ limit: "500", offset: "0" })
    assert.equal(parsed.success, false)
  })

  it("maps a listing row into the card the app renders", () => {
    const card = toMobileListingCard(ROW)
    if (!card) throw new Error("expected a listing card")
    assert.equal(card.title, "Album Twin")
    assert.equal(card.price_usd, 725.5)
    assert.equal(card.price_cents, 72550)
    assert.equal(card.price_label, "$725.50")
    assert.equal(card.condition_line, "Used — Good")
    assert.equal(card.shipping_label, "Shipping options at checkout")
    assert.equal(card.pickup_label, null)
    assert.equal(card.image_url, "https://cdn.example.com/full.jpg")
    assert.equal(card.condition_label, "Good")
  })

  it("maps seller and gallery onto the detail", () => {
    const detail = toMobileListingDetail(ROW)
    if (!detail) throw new Error("expected a listing detail")
    assert.equal(detail.seller.name, "North Shop")
    assert.equal(detail.seller.seller_slug, "north-shop")
    assert.deepEqual(detail.image_urls, ["https://cdn.example.com/full.jpg"])
    assert.equal(detail.description, "Light use.")
  })
})
