import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isLiveChatWidgetOnlyReply,
  liveChatEmailSafeReplyContent,
  shouldNotifyKlaviyoOnLiveChatEscalation,
  shouldNotifyKlaviyoOnLiveChatReply,
  shouldNotifyKlaviyoOnLiveChatSoftOpen,
} from "./klaviyo-policy.ts"
import { liveChatOrderTileReplyForOrders } from "./order-tile-intent.ts"

describe("live chat Klaviyo policy", () => {
  it("never emails on soft open", () => {
    assert.equal(shouldNotifyKlaviyoOnLiveChatSoftOpen(), false)
  })

  it("emails a customer-visible reply when the visitor left an address", () => {
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatReply({
        visitorEmail: "guest@example.com",
        content: "Browse /boards and check out through Reswell.",
      }),
      true,
    )
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatReply({
        visitorEmail: "  guest@example.com  ",
        content: "  here  ",
      }),
      true,
    )
  })

  it("rewrites tile and tap prompts so email is not a dead widget control", () => {
    const label =
      "You can update the ship-from address on a label for sales still waiting for carrier drop-off. Use the tiles below — pick the sale, say why, then choose the ship-from address. Ship-to stays the same."
    const order = "Tap the order below and I'll look that one up."
    const purchase = liveChatOrderTileReplyForOrders(
      [{ role: "buyer" }],
      "Where is my purchase?",
    )
    const sale = liveChatOrderTileReplyForOrders([{ role: "seller" }], "Where is my payout?")
    const roleAsk = liveChatOrderTileReplyForOrders(
      [{ role: "buyer" }, { role: "seller" }],
      "Where is my order?",
    )

    assert.equal(isLiveChatWidgetOnlyReply(label), true)
    assert.equal(isLiveChatWidgetOnlyReply(order), true)
    assert.equal(isLiveChatWidgetOnlyReply(purchase), true)
    assert.equal(isLiveChatWidgetOnlyReply(sale), true)
    assert.equal(isLiveChatWidgetOnlyReply(roleAsk), true)
    assert.equal(
      isLiveChatWidgetOnlyReply("Browse /boards and check out through Reswell."),
      false,
    )

    assert.match(liveChatEmailSafeReplyContent(label), /reopen the conversation/i)
    assert.doesNotMatch(liveChatEmailSafeReplyContent(label), /tiles below/i)
    assert.match(liveChatEmailSafeReplyContent(order), /reopen the conversation/i)
    assert.doesNotMatch(liveChatEmailSafeReplyContent(order), /tap the order below/i)
    assert.match(liveChatEmailSafeReplyContent(roleAsk), /purchases and sales/i)
    assert.doesNotMatch(liveChatEmailSafeReplyContent(roleAsk), /tap one/i)

    assert.equal(
      shouldNotifyKlaviyoOnLiveChatReply({
        visitorEmail: "guest@example.com",
        content: order,
      }),
      true,
    )
    assert.equal(
      liveChatEmailSafeReplyContent("Browse /boards and check out through Reswell."),
      "Browse /boards and check out through Reswell.",
    )
  })

  it("skips reply email without an address or body", () => {
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatReply({
        visitorEmail: null,
        content: "Hayden is typing a reply.",
      }),
      false,
    )
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatReply({
        visitorEmail: "  ",
        content: "Hayden is typing a reply.",
      }),
      false,
    )
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatReply({
        visitorEmail: "guest@example.com",
        content: "   ",
      }),
      false,
    )
  })

  it("emails only on newly opened formal escalations", () => {
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatEscalation({ alreadyLinked: false, reason: "manual" }),
      true,
    )
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatEscalation({ alreadyLinked: false, reason: "auto_unanswered" }),
      true,
    )
    assert.equal(
      shouldNotifyKlaviyoOnLiveChatEscalation({ alreadyLinked: true, reason: "manual" }),
      false,
    )
  })
})
