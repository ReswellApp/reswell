import assert from "node:assert/strict"
import { describe, it } from "node:test"
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

describe("new-account fraud ban", () => {
  it("bans a 3-hour-old account on the third blocked scam DM", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: createdAtHoursAgo(3),
        blockingFraudMessageCount: NEW_ACCOUNT_FRAUD_BAN_THRESHOLD,
        nowMs: NOW,
      }),
      true,
    )
  })

  it("does not ban before the third blocked scam DM", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: createdAtHoursAgo(1),
        blockingFraudMessageCount: 2,
        nowMs: NOW,
      }),
      false,
    )
  })

  it("does not ban an account that is 24 hours old or older", () => {
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: createdAtHoursAgo(24),
        blockingFraudMessageCount: 5,
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
        blockingFraudMessageCount: 3,
        nowMs: NOW,
      }),
      false,
    )
    assert.equal(
      shouldPermanentlyBanNewAccountForFraud({
        accountCreatedAt: "not-a-date",
        blockingFraudMessageCount: 3,
        nowMs: NOW,
      }),
      false,
    )
  })
})
