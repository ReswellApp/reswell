import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildMobileSaleDetail, toMobileSaleListItem } from "./mobileSalesMap.ts"
import type { MobileSaleDetailRow, MobileSaleListRow } from "@/lib/db/mobile-sales"

const LISTING_ID = "11111111-1111-4111-8111-111111111111"
const ORDER_ID = "44444444-4444-4444-8444-444444444444"
const BUYER_ID = "33333333-3333-4333-8333-333333333333"

const LIST_ROW: MobileSaleListRow = {
  id: ORDER_ID,
  order_num: "YMCBKQ",
  amount: "450",
  shipping_amount: "0",
  platform_fee: "31.50",
  seller_earnings: "418.50",
  promo_discount_usd: "0",
  status: "confirmed",
  delivery_status: "pickup_ready",
  tracking_number: null,
  tracking_detail: null,
  created_at: "2026-10-21T17:00:00.000Z",
  shipping_address: null,
  fulfillment_method: "pickup",
  buyer_id: BUYER_ID,
  listing: {
    id: LISTING_ID,
    title: "5'8\" simon shapes hand shape custom",
    condition: "excellent",
    listing_images: [{ url: "https://cdn.example.com/board.jpg", is_primary: true }],
  },
  order_item_listings: [],
  buyer_name: "milesjackler",
}

describe("mobile sales", () => {
  it("maps a pickup sale list row with earnings and awaiting pickup", () => {
    const item = toMobileSaleListItem(LIST_ROW, { preparedLabel: false, returnSummary: null })
    if (!item) throw new Error("expected a sale")
    assert.equal(item.order_number, "YMCBKQ")
    assert.equal(item.listing_title, "5'8\" Simon Shapes Hand Shape Custom")
    assert.equal(item.buyer_name, "milesjackler")
    assert.equal(item.detail_line, "Excellent · Local pickup")
    assert.equal(item.seller_earnings_label, "$418.50")
    assert.equal(item.primary_suffix, "earnings")
    assert.equal(item.show_shipping, false)
    assert.equal(item.status_label, "Awaiting pickup")
    assert.equal(item.status_tone, "warning")
    assert.equal(item.needs_fulfillment, true)
    assert.equal(item.pending_kind, "pickup")
    assert.equal(item.counterparty_name, "milesjackler")
  })

  it("builds sale details with order amounts, pickup verify, and payout hold", () => {
    const detailRow: MobileSaleDetailRow = {
      ...LIST_ROW,
      refunded_at: null,
      tracking_carrier: null,
      listing_id: LISTING_ID,
      stripe_checkout_session_id: "cs_test_123",
      order_items: [
        {
          sort_order: 0,
          item_price: "450",
          listing: {
            id: LISTING_ID,
            title: "5'8\" simon shapes hand shape custom",
            slug: "simon-shapes",
            condition: "excellent",
            listing_images: [{ url: "https://cdn.example.com/board.jpg", is_primary: true }],
          },
        },
      ],
      listing_slug: "simon-shapes",
      payout_status: "held",
      payout_hold_reason: "awaiting_pickup",
    }

    const detail = buildMobileSaleDetail(detailRow, {
      conversationId: null,
      labelAvailable: false,
      trackUrl: null,
      preparedLabel: false,
      returnSummary: null,
    })
    if (!detail) throw new Error("expected sale details")
    assert.equal(detail.order_number, "YMCBKQ")
    assert.equal(detail.items.length, 1)
    assert.equal(detail.items[0]?.buyer_name, "milesjackler")
    assert.equal(detail.item_amount_label, "$450.00")
    assert.equal(detail.platform_fee_label, "-$31.50")
    assert.equal(detail.show_platform_fee, true)
    assert.equal(detail.seller_earnings_label, "$418.50")
    assert.equal(detail.payment_label, "Card")
    assert.equal(detail.status_label, "Awaiting pickup")
    assert.equal(detail.can_verify_pickup, true)
    assert.equal(detail.is_pickup, true)
    assert.equal(detail.delivery_badge_label, "Ready for pickup")
    assert.equal(detail.payout_badge_label, "Held — awaiting pickup")
    assert.equal(detail.can_request_support, true)
  })
})
