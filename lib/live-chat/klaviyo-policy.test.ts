import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  shouldNotifyKlaviyoOnLiveChatEscalation,
  shouldNotifyKlaviyoOnLiveChatReply,
  shouldNotifyKlaviyoOnLiveChatSoftOpen,
} from "./klaviyo-policy.ts"

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
