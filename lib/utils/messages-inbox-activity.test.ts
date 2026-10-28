import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { MessagesInboxNotification } from "../db/messagesInbox.ts"
import { inboxActivityNotificationHref } from "./messages-inbox-activity.ts"

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

  it("still opens the listing for saves", () => {
    assert.equal(inboxActivityNotificationHref(note()), "/l/patagonia-surfboard")
  })
})
