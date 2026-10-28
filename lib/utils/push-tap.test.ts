import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { messagePushDelivery, pushDeliveriesFromPlanned } from "@/lib/services/push-payload"
import type { PlannedDelivery } from "@/lib/services/notifications/plan"
import { pushTapRoute } from "./push-tap.ts"

function offerDelivery(): PlannedDelivery {
  return {
    action: "deliver",
    recordLog: true,
    logOutcome: "delivered",
    logType: "offer_received",
    logDedupeKey: "offer_received:1",
    subjectKey: "offer-1",
    rollupKey: null,
    lockScreen: true,
    row: {
      userId: "user-1",
      type: "offer_received",
      actorId: "user-2",
      listingId: "listing-1",
      title: "New offer",
      body: "Alex offered $400",
      href: "/l/listing-1",
      dedupeKey: "offer_received:1",
      metadata: {},
    },
  }
}

describe("pushTapRoute", () => {
  it("opens a chat thread from a message alert", () => {
    const push = messagePushDelivery({
      receiverUserId: "user-1",
      conversationId: "conv-1",
      listingId: "listing-1",
      senderName: "Alex",
      message: "Still for sale?",
    })
    assert.ok(push)
    assert.deepEqual(pushTapRoute(push.data), { kind: "messages", id: "conv-1" })
  })

  it("opens the listing from an offer alert", () => {
    const [push] = pushDeliveriesFromPlanned([offerDelivery()])
    assert.ok(push)
    assert.deepEqual(pushTapRoute(push.data), { kind: "listing", id: "listing-1" })
  })
})
