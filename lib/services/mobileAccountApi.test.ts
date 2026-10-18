import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileDashboardSchema } from "@reswell/api-contract"
import { toMobileOffer, toMobileOrder, toMobileReview, toMobileSale } from "./mobileAccountMap.ts"
import { mobileDashboardPages } from "./mobileDashboardPages.ts"
import { shipperJobActions, supportStatusLabel } from "./mobileDashboardSectionMap.ts"
import type { MobileOrderRow, MobileReviewRow } from "@/lib/db/mobile-account"
import type { DashboardOfferRow } from "@/lib/types/offers-dashboard"

const OFFER: DashboardOfferRow = {
  id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
  status: "PENDING",
  current_amount: "640",
  initial_amount: "640",
  expires_at: "2026-10-10T00:00:00.000Z",
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  counter_count: 0,
  listing_id: "11111111-1111-4111-8111-111111111111",
  buyer_id: "22222222-2222-4222-8222-222222222222",
  seller_id: "33333333-3333-4333-8333-333333333333",
  listings: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Album Twin",
    slug: "album-twin",
    section: "surfboards",
    price: 725,
    status: "active",
    listing_images: [{ url: "https://cdn.example.com/board.jpg", is_primary: true }],
  },
  buyer_note: "Can you do 640?",
  seller_counter_note: null,
}

const ORDER: MobileOrderRow = {
  id: "44444444-4444-4444-8444-444444444444",
  order_num: "1042",
  amount: "725.5",
  seller_earnings: "680",
  status: "confirmed",
  delivery_status: "shipped",
  tracking_number: "1Z999",
  created_at: "2026-10-02T00:00:00.000Z",
  fulfillment_method: "shipping",
  listing: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Album Twin",
    listing_images: [{ url: "https://cdn.example.com/board.jpg", is_primary: true }],
  },
  counterparty_name: "North Shop",
}

describe("mobile account contract", () => {
  it("maps an offer the buyer sent", () => {
    const offer = toMobileOffer(OFFER, "sent", { id: OFFER.seller_id, display_name: "North Shop", avatar_url: null, shop_name: null, is_shop: false })
    if (!offer) throw new Error("expected an offer")
    assert.equal(offer.role, "sent")
    assert.equal(offer.amount_label, "$640.00")
    assert.equal(offer.listing_title, "Album Twin")
    assert.equal(offer.counterparty_name, "North Shop")
    assert.equal(offer.note, null)
  })

  it("keeps the buyer note on an offer the seller received", () => {
    const offer = toMobileOffer(OFFER, "received", { id: OFFER.buyer_id, display_name: "Alex", avatar_url: null, shop_name: null, is_shop: false })
    if (!offer) throw new Error("expected an offer")
    assert.equal(offer.note, "Can you do 640?")
    assert.equal(offer.counterparty_name, "Alex")
  })

  it("maps a purchase without seller earnings", () => {
    const order = toMobileOrder(ORDER)
    if (!order) throw new Error("expected an order")
    assert.equal(order.order_number, "1042")
    assert.equal(order.amount_label, "$725.50")
    assert.equal(order.status_label, "Confirmed")
    assert.equal(order.fulfillment_label, "Ship to you")
    assert.equal(order.counterparty_name, "North Shop")
    assert.equal("seller_earnings_usd" in order, false)
  })

  it("maps a sale with earnings", () => {
    const sale = toMobileSale(ORDER)
    if (!sale) throw new Error("expected a sale")
    assert.equal(sale.seller_earnings_label, "$680.00")
    assert.equal(sale.fulfillment_label, "Shipping")
  })

  it("marks a review of the seller's own listing", () => {
    const row: MobileReviewRow = {
      id: "55555555-5555-4555-8555-555555555555",
      rating: 5,
      comment: " Fast ship. ",
      created_at: "2026-09-01T00:00:00.000Z",
      reviewer_name: "Alex",
      listing_seller_id: "33333333-3333-4333-8333-333333333333",
    }
    const review = toMobileReview(row, "33333333-3333-4333-8333-333333333333")
    if (!review) throw new Error("expected a review")
    assert.equal(review.role, "seller")
    assert.equal(review.comment, "Fast ship.")
    assert.equal(review.reviewer_name, "Alex")
  })

  it("accepts a seller dashboard summary", () => {
    const parsed = mobileDashboardSchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      email: "seller@reswell.app",
      display_name: "North Shop",
      seller_slug: "north-shop",
      avatar_url: null,
      about: "Used boards",
      website_url: "https://www.reswell.app",
      follower_count: 2,
      following_count: 1,
      review_count: 0,
      rating_average: 0,
      active_listing_count: 3,
      sold_count: 1,
      purchase_count: 4,
      favorite_count: 6,
      pending_offer_count: 1,
      unread_message_count: 0,
      earnings_lifetime_usd: 680,
      earnings_lifetime_label: "$680.00",
      wallet_balance_usd: 120.5,
      wallet_balance_label: "$120.50",
      pages: [{ id: "overview", label: "Overview" }],
    })
    assert.equal(parsed.sold_count, 1)
    assert.equal(parsed.purchase_count, 4)
    assert.equal(parsed.earnings_lifetime_label, "$680.00")
  })

  it("returns the dashboard pages this account is allowed to open", () => {
    const member = mobileDashboardPages({
      isAdmin: false,
      isShipper: false,
      hasShopifyAccess: false,
      hasSellerProfile: false,
    }).map((page) => page.label)
    assert.deepEqual(member, [
      "Overview",
      "Profile",
      "Earnings",
      "My Listings",
      "Offers",
      "Messages",
      "Support",
      "Purchases",
      "Sales",
      "Favorites",
      "Following",
    ])

    const shop = mobileDashboardPages({
      isAdmin: true,
      isShipper: true,
      hasShopifyAccess: true,
      hasSellerProfile: true,
    }).map((page) => page.id)
    assert.equal(supportStatusLabel("waiting_on_you"), "Waiting on you")
    assert.deepEqual(
      shipperJobActions("waiting_for_run", true).map((action) => action.status),
      ["picked_up", "cancelled"],
    )
    assert.equal(shipperJobActions("picked_up", false).length, 0)

    assert.deepEqual(shop, [
      "overview",
      "shipper",
      "profile",
      "earnings",
      "balance-sheet",
      "listings",
      "shopify",
      "offers",
      "messages",
      "support",
      "purchases",
      "sales",
      "favorites",
      "following",
      "seller-profile",
    ])
  })
})