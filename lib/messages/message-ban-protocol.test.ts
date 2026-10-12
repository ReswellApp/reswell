import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ACCOUNT_BANNED_USER_MESSAGE, PERMANENT_ACCOUNT_RESTRICTED_UNTIL } from "./account-ban-errors.ts"
import { MESSAGE_BLOCKED_POLICY_ERROR } from "./policy-errors.ts"
import { MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR } from "./send-restriction-errors.ts"
import {
  accountBannedSendRestrictionResult,
  fraudRowCountsTowardPhishingBan,
  sendResultAfterBlockedFraudCapture,
  shouldRateLimitNewRecipient,
  unionRecipientIds,
} from "./message-ban-protocol.ts"

describe("unionRecipientIds", () => {
  it("dedupes delivered DMs and blocked fraud attempts", () => {
    assert.deepEqual(unionRecipientIds(["a", "b"], ["b", "c"]).sort(), ["a", "b", "c"])
    assert.deepEqual(unionRecipientIds([], ["x"]), ["x"])
    assert.deepEqual(unionRecipientIds(["x"], []), ["x"])
  })
})

describe("shouldRateLimitNewRecipient", () => {
  it("allows a fourth unique recipient only after three others were already contacted", () => {
    assert.equal(
      shouldRateLimitNewRecipient({
        distinctRecipientIds: ["a", "b", "c"],
        recipientId: "d",
        maxUniqueRecipients: 3,
      }),
      true,
    )
    assert.equal(
      shouldRateLimitNewRecipient({
        distinctRecipientIds: ["a", "b"],
        recipientId: "c",
        maxUniqueRecipients: 3,
      }),
      false,
    )
  })

  it("never rate-limits a recipient already contacted this window", () => {
    assert.equal(
      shouldRateLimitNewRecipient({
        distinctRecipientIds: ["a", "b", "c"],
        recipientId: "a",
        maxUniqueRecipients: 3,
      }),
      false,
    )
  })
})

describe("fraudRowCountsTowardPhishingBan", () => {
  it("counts pending or confirmed phishing heuristics", () => {
    assert.equal(
      fraudRowCountsTowardPhishingBan({
        reasonCode: "phishing_like",
        llmReviewStatus: "pending",
      }),
      true,
    )
    assert.equal(
      fraudRowCountsTowardPhishingBan({
        reasonCode: "phishing_like",
        llmReviewStatus: "confirmed",
      }),
      true,
    )
  })

  it("counts an LLM remap onto phishing", () => {
    assert.equal(
      fraudRowCountsTowardPhishingBan({
        reasonCode: "external_link",
        llmReviewReasonCode: "phishing_like",
        llmReviewStatus: "confirmed",
      }),
      true,
    )
  })

  it("does not count dismissed rows or contact-sharing blocks", () => {
    assert.equal(
      fraudRowCountsTowardPhishingBan({
        reasonCode: "phishing_like",
        llmReviewStatus: "dismissed",
      }),
      false,
    )
    assert.equal(
      fraudRowCountsTowardPhishingBan({
        reasonCode: "phone_like",
        llmReviewStatus: "confirmed",
      }),
      false,
    )
    assert.equal(
      fraudRowCountsTowardPhishingBan({
        reasonCode: "off_platform_payment",
        llmReviewReasonCode: "off_platform_payment",
        llmReviewStatus: "confirmed",
      }),
      false,
    )
  })
})

describe("sendResultAfterBlockedFraudCapture", () => {
  it("returns the permanent-ban restriction when the sender was just banned", () => {
    assert.deepEqual(
      sendResultAfterBlockedFraudCapture({ reasonCode: "phishing_like", banned: true }),
      {
        error: ACCOUNT_BANNED_USER_MESSAGE,
        restrictionCode: MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
        restrictedUntil: PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
      },
    )
    assert.deepEqual(accountBannedSendRestrictionResult().restrictionCode, MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR)
  })

  it("returns a policy block when delivery is stopped without a ban", () => {
    assert.deepEqual(
      sendResultAfterBlockedFraudCapture({ reasonCode: "phone_like", banned: false }),
      { error: MESSAGE_BLOCKED_POLICY_ERROR, policyReason: "phone_like" },
    )
  })
})
