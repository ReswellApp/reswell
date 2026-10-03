import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  GOOGLE_MERCHANT_PRODUCT_EXPIRY_DAYS,
  GOOGLE_MERCHANT_REVALIDATE_AFTER_DAYS,
  GOOGLE_MERCHANT_REVALIDATE_RETRY_COOLDOWN_HOURS,
  googleMerchantRevalidateCutoff,
  googleMerchantRevalidateRetryCutoff,
  isGoogleMerchantPublicationDue,
} from "./publication.ts"

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

describe("Google Merchant publication expiry", () => {
  const now = new Date("2026-09-30T17:00:00.000Z")

  it("refreshes one day before the 30-day Merchant Center expiry", () => {
    assert.equal(GOOGLE_MERCHANT_PRODUCT_EXPIRY_DAYS, 30)
    assert.equal(GOOGLE_MERCHANT_REVALIDATE_AFTER_DAYS, 29)
    assert.equal(GOOGLE_MERCHANT_REVALIDATE_RETRY_COOLDOWN_HOURS, 12)

    const cutoff = googleMerchantRevalidateCutoff(now)
    assert.equal(cutoff.toISOString(), "2026-09-01T17:00:00.000Z")
    assert.equal(now.getTime() - cutoff.getTime(), 29 * DAY_MS)
  })

  it("treats a missing publish date as due", () => {
    assert.equal(
      isGoogleMerchantPublicationDue({
        publishedAt: null,
        lastAttemptAt: null,
        referenceTime: now,
      }),
      true,
    )
  })

  it("waits until the listing has been published for 29 days", () => {
    const publishedAt = new Date(now.getTime() - 29 * DAY_MS + 1)
    assert.equal(
      isGoogleMerchantPublicationDue({
        publishedAt,
        lastAttemptAt: publishedAt,
        referenceTime: now,
      }),
      false,
    )

    const dueAt = new Date(now.getTime() - 29 * DAY_MS)
    assert.equal(
      isGoogleMerchantPublicationDue({
        publishedAt: dueAt,
        lastAttemptAt: dueAt,
        referenceTime: now,
      }),
      true,
    )
  })

  it("cools down a recent failed attempt", () => {
    const publishedAt = new Date(now.getTime() - 40 * DAY_MS)
    const recentFailure = new Date(now.getTime() - HOUR_MS)
    assert.equal(
      isGoogleMerchantPublicationDue({
        publishedAt,
        lastAttemptAt: recentFailure,
        referenceTime: now,
      }),
      false,
    )

    const cooledDown = googleMerchantRevalidateRetryCutoff(now)
    assert.equal(
      isGoogleMerchantPublicationDue({
        publishedAt,
        lastAttemptAt: cooledDown,
        referenceTime: now,
      }),
      true,
    )
  })
})
