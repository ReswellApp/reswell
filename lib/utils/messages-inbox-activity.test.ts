import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { MessagesInboxNotification } from "../db/messagesInbox.ts"
import { activityKindLabel, inboxActivityNotificationHref } from "./messages-inbox-activity.ts"

const ORDER_ID = "11111111-1111-4111-8111-111111111111"

function note(overrides: Partial<MessagesInboxNotification> = {}): MessagesInboxNotification {
  return {
    id: "n-1",
    type: "listing_saved",
    listing_id: "listing-1",
    actor_id: null,
    message: "Someone saved your item",
    is_read: true,
    created_at: "2026-10-28T12:00:00.000Z",
    listings: {
      id: "listing-1",
      slug: "patagonia-surfboard",
      title: "Patagonia Surfboard",
      section: "surfboards",
    },
    ...overrides,
  }
}

describe("activityKindLabel", () => {
  it("labels review prompts as Review", () => {
    assert.equal(activityKindLabel("review_seller_requested"), "Review")
    assert.equal(activityKindLabel("review_buyer_requested"), "Review")
  })
})

describe("inboxActivityNotificationHref", () => {
  it("opens the seller sale for an order delivered payout, not the listing", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "order_delivered_payout",
          href: "/l/patagonia-surfboard",
          metadata: { orderId: ORDER_ID },
        }),
      ),
      `/dashboard/sales/${ORDER_ID}`,
    )
  })

  it("falls back to the sales list when the seller order id is missing", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "order_delivered_payout",
          href: "/l/patagonia-surfboard",
        }),
      ),
      "/dashboard/sales",
    )
  })

  it("opens the buyer purchase for an order delivered notice, not the listing", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "order_delivered",
          href: `/dashboard/purchases/${ORDER_ID}`,
        }),
      ),
      `/dashboard/purchases/${ORDER_ID}`,
    )
  })

  it("opens the buyer purchase for a leave-seller-review notice", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "review_seller_requested",
          href: `/dashboard/purchases/${ORDER_ID}`,
          metadata: { orderId: ORDER_ID },
        }),
      ),
      `/dashboard/purchases/${ORDER_ID}`,
    )
  })

  it("opens the seller sale for a leave-buyer-review notice", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "review_buyer_requested",
          href: "/l/patagonia-surfboard",
          metadata: { orderId: ORDER_ID },
        }),
      ),
      `/dashboard/sales/${ORDER_ID}`,
    )
  })

  it("still opens the listing for saves", () => {
    assert.equal(inboxActivityNotificationHref(note()), "/l/patagonia-surfboard")
  })

  it("opens the offer screen for offer activity, not the listing", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "offer_received",
          href: "/l/patagonia-surfboard",
          metadata: { offerId: ORDER_ID },
        }),
      ),
      `/dashboard/offers?offer=${ORDER_ID}`,
    )
  })

  it("reads the offer id from a dashboard href when metadata is missing", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "offer_accepted",
          href: `/dashboard/offers?offer=${ORDER_ID}`,
        }),
      ),
      `/dashboard/offers?offer=${ORDER_ID}`,
    )
  })

  it("falls back to the offers list when the offer id is missing", () => {
    assert.equal(
      inboxActivityNotificationHref(
        note({
          type: "offer_countered",
          href: "/l/patagonia-surfboard",
        }),
      ),
      "/dashboard/offers",
    )
  })
})
