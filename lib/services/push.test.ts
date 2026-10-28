import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  chunkExpoPushMessages,
  compactPushData,
  expoPushMessagesForDeliveries,
  isExpoPushToken,
  messagePushDelivery,
  pushDeliveriesFromPlanned,
  tokensToDisableFromTickets,
  truncatePushText,
  type ExpoPushMessage,
  type PushDelivery,
} from "./push-payload.ts"
import type { PlannedDelivery } from "@/lib/services/notifications/plan"

const TOKEN = "ExponentPushToken[abcdefghij]"

function delivery(patch: Partial<PlannedDelivery> = {}): PlannedDelivery {
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
    ...patch,
  }
}

describe("isExpoPushToken", () => {
  it("accepts Expo and Exponent tokens", () => {
    assert.equal(isExpoPushToken("ExponentPushToken[abc]"), true)
    assert.equal(isExpoPushToken("ExpoPushToken[abc]"), true)
  })

  it("rejects empty and non-Expo values", () => {
    assert.equal(isExpoPushToken(""), false)
    assert.equal(isExpoPushToken("not-a-token"), false)
  })
})

describe("truncatePushText", () => {
  it("collapses whitespace and ellipsizes", () => {
    assert.equal(truncatePushText("  hello   there  ", 20), "hello there")
    assert.equal(truncatePushText("abcdefghij", 4), "abc…")
  })
})

describe("pushDeliveriesFromPlanned", () => {
  it("sends lock-screen rows and skips quieter in-app-only updates", () => {
    const planned = [
      delivery(),
      delivery({ recordLog: false, lockScreen: false }),
      delivery({ logOutcome: "digested", recordLog: true, lockScreen: false }),
    ]
    const deliveries = pushDeliveriesFromPlanned(planned)
    assert.equal(deliveries.length, 1)
    assert.equal(deliveries[0]?.topic, "offers")
    assert.deepEqual(deliveries[0]?.data, {
      kind: "notification",
      type: "offer_received",
      href: "/l/listing-1",
      listing_id: "listing-1",
    })
  })

  it("sends a first digest", () => {
    const planned = [
      delivery({
        logOutcome: "digested",
        lockScreen: true,
        row: {
          userId: "user-1",
          type: "listing_saved_digest",
          actorId: null,
          listingId: null,
          title: "More people saved your listings",
          body: "2 more people saved your listings today.",
          href: "/dashboard/listings",
          dedupeKey: "listing_saved_digest:2026-10-21",
          metadata: { count: 2 },
        },
      }),
    ]
    const deliveries = pushDeliveriesFromPlanned(planned)
    assert.equal(deliveries.length, 1)
    assert.equal(deliveries[0]?.data.type, "listing_saved_digest")
  })
})

describe("messagePushDelivery", () => {
  it("builds a chat payload", () => {
    const push = messagePushDelivery({
      receiverUserId: "user-1",
      conversationId: "conv-1",
      listingId: "listing-1",
      senderName: "Alex",
      message: "Is this still available?",
    })
    assert.ok(push)
    assert.equal(push?.title, "New message")
    assert.equal(push?.body, "Alex: Is this still available?")
    assert.equal(push?.topic, "messages")
    assert.deepEqual(push?.data, {
      kind: "message",
      conversation_id: "conv-1",
      listing_id: "listing-1",
    })
  })

  it("drops blank ids", () => {
    assert.equal(
      messagePushDelivery({
        receiverUserId: " ",
        conversationId: "conv-1",
        message: "hi",
      }),
      null,
    )
  })
})

describe("expoPushMessagesForDeliveries", () => {
  it("fans out to opted-in device tokens and skips everyone else", () => {
    const deliveries: PushDelivery[] = [
      {
        userId: "user-1",
        title: "New offer",
        body: "Alex offered $400",
        topic: "offers",
        data: compactPushData({ kind: "notification" }),
      },
      {
        userId: "user-2",
        title: "New offer",
        body: "Skipped",
        topic: "offers",
        data: compactPushData({ kind: "notification" }),
      },
    ]
    const messages = expoPushMessagesForDeliveries(
      deliveries,
      [
        { user_id: "user-1", expo_push_token: TOKEN },
        { user_id: "user-1", expo_push_token: "bad" },
        { user_id: "user-2", expo_push_token: "ExpoPushToken[other]" },
      ],
      new Map([
        [
          "user-2",
          { messages: false, offers: false, saves: false, follows: false, orders: false },
        ],
      ]),
    )
    assert.equal(messages.length, 1)
    assert.equal(messages[0]?.to, TOKEN)
    assert.equal(messages[0]?.sound, "default")
  })

  it("skips a topic the user turned off", () => {
    const messages = expoPushMessagesForDeliveries(
      [
        {
          userId: "user-1",
          title: "New message",
          body: "Alex: hi",
          topic: "messages",
          data: compactPushData({ kind: "message", conversation_id: "conv-1" }),
        },
        {
          userId: "user-1",
          title: "New offer",
          body: "Alex offered $400",
          topic: "offers",
          data: compactPushData({ kind: "notification", href: "/l/listing-1", listing_id: "listing-1" }),
        },
      ],
      [{ user_id: "user-1", expo_push_token: TOKEN }],
      new Map([
        [
          "user-1",
          { messages: false, offers: true, saves: true, follows: true, orders: true },
        ],
      ]),
    )
    assert.equal(messages.length, 1)
    assert.equal(messages[0]?.title, "New offer")
  })
})

describe("tokensToDisableFromTickets", () => {
  it("maps DeviceNotRegistered tickets back onto the chunk", () => {
    const messages: ExpoPushMessage[] = [
      { to: TOKEN, title: "A", body: "B", sound: "default", data: {} },
      { to: "ExpoPushToken[keep]", title: "A", body: "B", sound: "default", data: {} },
    ]
    const expired = tokensToDisableFromTickets(messages, [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "ok", id: "ticket-1" },
    ])
    assert.deepEqual(expired, [TOKEN])
  })
})

describe("chunkExpoPushMessages", () => {
  it("keeps a short list in one request", () => {
    const messages: ExpoPushMessage[] = [
      { to: TOKEN, title: "A", body: "B", sound: "default", data: {} },
    ]
    assert.equal(chunkExpoPushMessages(messages).length, 1)
  })
})
