import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  shouldNotifyKlaviyoOnLiveChatAutoReply,
  shouldNotifyKlaviyoOnLiveChatEscalation,
  shouldNotifyKlaviyoOnLiveChatSoftOpen,
} from "./klaviyo-policy.ts"

describe("live chat Klaviyo policy", () => {
  it("never emails on soft open or auto-reply", () => {
    assert.equal(shouldNotifyKlaviyoOnLiveChatSoftOpen(), false)
    assert.equal(shouldNotifyKlaviyoOnLiveChatAutoReply(), false)
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
