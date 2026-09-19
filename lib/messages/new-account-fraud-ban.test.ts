import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { messagePolicyCountsTowardPhishingBan } from "./fraud-reason-codes.ts"
import {
  NEW_ACCOUNT_FRAUD_BAN_MAX_AGE_MS,
  NEW_ACCOUNT_FRAUD_BAN_THRESHOLD,
  isAccountNewerThanFraudBanWindow,
  shouldPermanentlyBanNewAccountForFraud,
} from "./new-account-fraud-ban.ts"

const NOW = Date.parse("2026-09-18T12:00:00.000Z")

function createdAtHoursAgo(hours: number): string {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString()
}

describe("new-account phishing ban", () => {
  it("bans a 3-hour-old account on the third phishing DM", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: createdAtHoursAgo(3),
        phishingMessageCount: NEW_ACCOUNT_FRAUD_BAN_THRESHOLD,
        latestReasonCode: "phishing_like",
        nowMs: NOW,
      }),
      true,
    )
  })

  it("does not ban phone, email, or off-platform payment blocks", () => {
    for (const latestReasonCode of [
      "phone_like",
      "phone_fragment",
      "email_like",
      "off_platform_payment",
      "external_link",
    ] as const) {
      assert.equal(
        shouldPermanentlyBanNewAccountForFraud({
          accountCreatedAt: createdAtHoursAgo(1),
          phishingMessageCount: 5,
          latestReasonCode,
          nowMs: NOW,
        }),
        false,
        latestReasonCode,
      )
    }
  })

  it("does not ban before the third phishing DM", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: createdAtHoursAgo(1),
        phishingMessageCount: 2,
        latestReasonCode: "phishing_like",
        nowMs: NOW,
      }),
      false,
    )
  })

  it("does not ban an account that is 24 hours old or older", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: createdAtHoursAgo(24),
        phishingMessageCount: 5,
        latestReasonCode: "phishing_like",
        nowMs: NOW,
      }),
      false,
    )
    assert.equal(isAccountNewerThanFraudBanWindow(createdAtHoursAgo(24), NOW), false)
    assert.equal(
      isAccountNewerThanFraudBanWindow(
        new Date(NOW - NEW_ACCOUNT_FRAUD_BAN_MAX_AGE_MS + 1).toISOString(),
        NOW,
      ),
      true,
    )
  })

  it("does not ban when created_at is missing or invalid", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: null,
        phishingMessageCount: 3,
        latestReasonCode: "phishing_like",
        nowMs: NOW,
      }),
      false,
    )
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: "not-a-date",
        phishingMessageCount: 3,
        latestReasonCode: "phishing_like",
        nowMs: NOW,
      }),
      false,
    )
  })
})

describe("messagePolicyCountsTowardPhishingBan", () => {
  it("only counts impersonation / click-a-link phishing", () => {
    assert.equal(messagePolicyCountsTowardPhishingBan("phishing_like"), true)
    assert.equal(messagePolicyCountsTowardPhishingBan("phone_like"), false)
    assert.equal(messagePolicyCountsTowardPhishingBan("email_like"), false)
    assert.equal(messagePolicyCountsTowardPhishingBan("off_platform_payment"), false)
    assert.equal(messagePolicyCountsTowardPhishingBan("external_link"), false)
  })
})
