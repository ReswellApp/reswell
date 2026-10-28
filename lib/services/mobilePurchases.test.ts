import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildMobilePurchaseDetail, toMobilePurchaseListItem } from "./mobilePurchases.ts"
import type { MobilePurchaseDetailRow, MobilePurchaseListRow } from "@/lib/db/mobile-purchases"

const LISTING_ID = "11111111-1111-4111-8111-111111111111"
const ORDER_ID = "44444444-4444-4444-8444-444444444444"
const SELLER_ID = "33333333-3333-4333-8333-333333333333"

const LIST_ROW: MobilePurchaseListRow = {
  id: ORDER_ID,
  order_num: "GRV86Q",
  amount: "176.50",
  shipping_amount: "6.50",
  status: "confirmed",
  delivery_status: "pending",
  tracking_number: "9400111899223197428490",
  tracking_detail: {
    source: "shipengine",
    status_code: "AC",
    status_description: "Accepted",
    carrier_status_description: "Shipping Label Created",
    events: [{ occurred_at: "2026-10-27T17:51:00.000Z", description: "Shipping Label Created" }],
    updated_at: "2026-10-27T17:51:00.000Z",
  },
  created_at: "2026-10-27T17:51:00.000Z",
  shipping_address: {
    name: "Hayden Garfield",
    address: {
      line1: "915 DE LA VINA ST",
      city: "SANTA BARBARA",
      state: "CA",
      postal_code: "93101-3220",
      country: "US",
    },
  },
  fulfillment_method: "shipping",
  seller_id: SELLER_ID,
  listing: {
    id: LISTING_ID,
    title: "terramar surfco retro bmt twin surfboard fins",
    condition: "brand_new",
    listing_images: [{ url: "https://cdn.example.com/fins.jpg", is_primary: true }],
  },
  seller_name: "TERRAMAR SURF",
}

describe("mobile purchases", () => {
  it("maps a purchase list row with split price and carrier status", () => {
    const item = toMobilePurchaseListItem(LIST_ROW, null)
    if (!item) throw new Error("expected a purchase")
    assert.equal(item.order_number, "GRV86Q")
    assert.equal(item.listing_title, "Terramar Surfco Retro Bmt Twin Surfboard Fins")
    assert.equal(item.seller_name, "TERRAMAR SURF")
    assert.equal(item.detail_line, "Brand New")
    assert.equal(item.item_amount_label, "$170.00")
    assert.equal(item.shipping_amount_label, "$6.50")
    assert.equal(item.show_shipping, true)
    assert.equal(item.status_label, "Shipping Label Created")
    assert.equal(item.counterparty_name, "TERRAMAR SURF")
  })

  it("builds purchase details with timeline, address, and line items", () => {
    const detailRow: MobilePurchaseDetailRow = {
      ...LIST_ROW,
      refunded_at: null,
      carrier_delivered_at: null,
      tracking_carrier: "usps",
      listing_id: LISTING_ID,
      order_items: [
        {
          sort_order: 0,
          item_price: "85",
          listing: {
            id: LISTING_ID,
            title: "terramar surfco retro bmt twin surfboard fins all glass",
            slug: "retro-bmt",
            section: "fins",
            condition: "brand_new",
            listing_images: [{ url: "https://cdn.example.com/green.jpg", is_primary: true }],
          },
        },
        {
          sort_order: 1,
          item_price: "85",
          listing: {
            id: "55555555-5555-4555-8555-555555555555",
            title: "terramar surfco am pt all glass twin surfboard fins",
            slug: "am-pt",
            section: "fins",
            condition: "brand_new",
            listing_images: [{ url: "https://cdn.example.com/white.jpg", is_primary: true }],
          },
        },
      ],
      seller_slug: "terramar-surf",
      seller_avatar_url: null,
    }

    const detail = buildMobilePurchaseDetail(detailRow, null, {
      conversationId: null,
      buyerReview: null,
      sellerReview: null,
      trackUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=1",
    })
    if (!detail) throw new Error("expected purchase details")
    assert.equal(detail.order_number, "GRV86Q")
    assert.equal(detail.items.length, 2)
    assert.equal(detail.items[0]?.price_label, "$85.00")
    assert.equal(detail.item_amount_label, "$170.00")
    assert.equal(detail.shipping_amount_label, "$6.50")
    assert.equal(detail.total_amount_label, "$176.50")
    assert.equal(detail.timeline_heading, "Shipping Details")
    assert.equal(detail.timeline[0]?.title, "Purchased")
    assert.equal(detail.address_name, "Hayden Garfield")
    assert.ok(detail.address_lines.some((line) => line.includes("915 DE LA VINA ST")))
    assert.equal(detail.seller_handle, "terramar-surf")
    assert.equal(detail.can_review, false)
    assert.equal(detail.track_url, "https://tools.usps.com/go/TrackConfirmAction?tLabels=1")
  })
})
