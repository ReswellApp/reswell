/**
 * Merchant Center drops product data 30 days after the last successful update.
 * Shopping ads and free listings disappear with it.
 * @see https://support.google.com/merchants/answer/7052112
 */
export const GOOGLE_MERCHANT_PRODUCT_EXPIRY_DAYS = 30

/**
 * Resubmit the day before expiry. The cron is hourly, so a listing published
 * at T is refreshed once now >= T + 29 days, before Google removes it at T + 30 days.
 */
export const GOOGLE_MERCHANT_REVALIDATE_AFTER_DAYS = GOOGLE_MERCHANT_PRODUCT_EXPIRY_DAYS - 1

/** Failed publishes stay out of the cron queue so one bad listing cannot block the rest. */
export const GOOGLE_MERCHANT_REVALIDATE_RETRY_COOLDOWN_HOURS = 12

/** Per-run cap. Successful rows leave the queue; the next hour continues the backlog. */
export const GOOGLE_MERCHANT_REVALIDATE_BATCH_LIMIT = 150

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export function googleMerchantRevalidateCutoff(referenceTime: Date): Date {
  return new Date(referenceTime.getTime() - GOOGLE_MERCHANT_REVALIDATE_AFTER_DAYS * DAY_MS)
}

export function googleMerchantRevalidateRetryCutoff(referenceTime: Date): Date {
  return new Date(
    referenceTime.getTime() - GOOGLE_MERCHANT_REVALIDATE_RETRY_COOLDOWN_HOURS * HOUR_MS,
  )
}

/**
 * Mirrors `list_due_google_merchant_listing_ids` eligibility on the publish clock.
 * Listing status, section, price, and image checks stay in SQL.
 */
export function isGoogleMerchantPublicationDue(input: {
  publishedAt: Date | null
  lastAttemptAt: Date | null
  referenceTime: Date
}): boolean {
  const publishedAt = input.publishedAt
  const publishDue =
    publishedAt == null ||
    Number.isNaN(publishedAt.getTime()) ||
    publishedAt.getTime() <= googleMerchantRevalidateCutoff(input.referenceTime).getTime()
  if (!publishDue) return false

  const lastAttemptAt = input.lastAttemptAt
  if (lastAttemptAt == null || Number.isNaN(lastAttemptAt.getTime())) return true
  return lastAttemptAt.getTime() <= googleMerchantRevalidateRetryCutoff(input.referenceTime).getTime()
}
