import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  mobileCartBodySchema,
  mobileListingsQuerySchema,
  mobileMessageBodySchema,
  mobileOfferActionBodySchema,
  mobileProfileParamSchema,
} from "@reswell/api-contract"
import { toMobileListingCard, toMobileListingDetail, toMobileProfile } from "./mobileApi.ts"
import type { MobileProfileRow } from "@/lib/db/mobile-profiles"
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

  it("keeps a search query on the listings page", () => {
    const parsed = mobileListingsQuerySchema.parse({ q: " album ", section: "surfboards" })
    assert.equal(parsed.q, "album")
    assert.equal(parsed.section, "surfboards")
    assert.equal(parsed.limit, 20)
  })

  it("accepts a category and surfboard shape", () => {
    const parsed = mobileListingsQuerySchema.parse({ category: "fins", board_type: undefined })
    assert.equal(parsed.category, "fins")
    const shaped = mobileListingsQuerySchema.parse({ category: "surfboards", board_type: "fish" })
    assert.equal(shaped.board_type, "fish")
  })

  it("rejects a shape outside surfboards", () => {
    const parsed = mobileListingsQuerySchema.safeParse({ category: "wetsuits", board_type: "longboard" })
    assert.equal(parsed.success, false)
  })

  it("rejects an unknown shape", () => {
    const parsed = mobileListingsQuerySchema.safeParse({ board_type: "gun" })
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

const PROFILE: MobileProfileRow = {
  id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
  seller_slug: "north-shop",
  display_name: "North",
  avatar_url: "https://cdn.example.com/face.jpg",
  city: "Santa Cruz",
  location: "California",
  bio: "Personal bio",
  created_at: "2024-03-15T18:00:00.000Z",
  is_shop: true,
  shop_name: "North Shop",
  shop_description: " Boards and fins. ",
  shop_banner_url: "https://cdn.example.com/banner.jpg",
  shop_logo_url: "https://cdn.example.com/logo.jpg",
  shop_verified: true,
  shop_website: "https://north.example/shop",
  shop_phone: "831-555-0100",
  shop_address: "123 Pacific Ave",
  sales_count: 12,
  follower_count: 40,
  seller_banned_at: null,
}

describe("mobile write contract", () => {
  it("rejects an empty message and a counter without an amount", () => {
    assert.equal(mobileMessageBodySchema.safeParse({ body: "   " }).success, false)
    assert.equal(mobileOfferActionBodySchema.safeParse({ action: "counter" }).success, false)
    assert.equal(mobileOfferActionBodySchema.safeParse({ action: "withdraw" }).success, true)
    assert.equal(mobileCartBodySchema.parse({ listing_id: "11111111-1111-4111-8111-111111111111" }).quantity, 1)
  })
})

describe("mobile profile contract", () => {
  it("accepts a seller slug and rejects a path", () => {
    assert.equal(mobileProfileParamSchema.safeParse({ slug: "north-shop" }).success, true)
    assert.equal(mobileProfileParamSchema.safeParse({ slug: "../me" }).success, false)
  })

  it("maps a shop into the public profile the app renders", () => {
    const profile = toMobileProfile(PROFILE, {
      listingCount: 3,
      ratingAverage: 4.8,
      reviewCount: 9,
    })
    if (!profile) throw new Error("expected a profile")
    assert.equal(profile.name, "North Shop")
    assert.equal(profile.about, "Boards and fins.")
    assert.equal(profile.location_label, "123 Pacific Ave")
    assert.equal(profile.avatar_url, "https://cdn.example.com/logo.jpg")
    assert.equal(profile.banner_url, "https://cdn.example.com/banner.jpg")
    assert.equal(profile.verified, true)
    assert.equal(profile.website_url, "https://north.example/shop")
    assert.equal(profile.phone, "831-555-0100")
    assert.equal(profile.listing_count, 3)
    assert.equal(profile.rating_average, 4.8)
    assert.equal(profile.review_count, 9)
    assert.equal(profile.member_since_label, "March 2024")
  })

  it("uses the person name and drops a non-http website", () => {
    const profile = toMobileProfile(
      {
        ...PROFILE,
        is_shop: false,
        shop_description: null,
        shop_verified: true,
        shop_website: "javascript:alert(1)",
      },
      { listingCount: 0, ratingAverage: 0, reviewCount: 0 },
    )
    if (!profile) throw new Error("expected a profile")
    assert.equal(profile.name, "North")
    assert.equal(profile.is_shop, false)
    assert.equal(profile.verified, false)
    assert.equal(profile.avatar_url, "https://cdn.example.com/face.jpg")
    assert.equal(profile.about, "Personal bio")
    assert.equal(profile.website_url, null)
  })
})
