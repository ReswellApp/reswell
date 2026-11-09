import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  anyPushTopicEnabled,
  effectivePushTopics,
  pushPreferenceColumns,
  pushTopicForNotificationType,
} from "./push-topics.ts"

describe("effectivePushTopics", () => {
  it("defaults a missing row to all on", () => {
    assert.deepEqual(effectivePushTopics(null), {
      messages: true,
      offers: true,
      saves: true,
      follows: true,
      orders: true,
    })
  })

  it("treats master-off as every topic off", () => {
    assert.deepEqual(
      effectivePushTopics({
        push_opt_in: false,
        push_messages: true,
        push_offers: true,
        push_saves: true,
        push_follows: true,
        push_orders: true,
      }),
      {
        messages: false,
        offers: false,
        saves: false,
        follows: false,
        orders: false,
      },
    )
  })

  it("honors a single topic off", () => {
    const flags = effectivePushTopics({
      push_opt_in: true,
      push_messages: false,
    })
    assert.equal(flags.messages, false)
    assert.equal(flags.offers, true)
    assert.equal(anyPushTopicEnabled(flags), true)
  })
})

describe("pushTopicForNotificationType", () => {
  it("maps catalog types onto lock-screen groups", () => {
    assert.equal(pushTopicForNotificationType("offer_received"), "offers")
    assert.equal(pushTopicForNotificationType("offer_countered"), "offers")
    assert.equal(pushTopicForNotificationType("listing_saved"), "saves")
    assert.equal(pushTopicForNotificationType("listing_saved_digest"), "saves")
    assert.equal(pushTopicForNotificationType("new_listing_from_followed"), "follows")
    assert.equal(pushTopicForNotificationType("price_drop_from_followed"), "follows")
    assert.equal(pushTopicForNotificationType("order_delivered"), "orders")
    assert.equal(pushTopicForNotificationType("payout_info_required"), "orders")
  })
})

describe("pushPreferenceColumns", () => {
  it("turns master off when every topic is off", () => {
    assert.equal(
      pushPreferenceColumns({
        messages: false,
        offers: false,
        saves: false,
        follows: false,
        orders: false,
      }).push_opt_in,
      false,
    )
  })
})
