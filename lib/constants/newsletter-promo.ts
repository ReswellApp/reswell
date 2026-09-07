/** Newsletter welcome offer — Reswell absorbs the discount; sellers receive full item earnings. */

export const NEWSLETTER_PROMO_DISCOUNT_PERCENT = 15

/** Days until a generated code expires. */
export const NEWSLETTER_PROMO_VALIDITY_DAYS = 30

/** Days before expiry to bump unredeemed codes and send Klaviyo **Newsletter Promo Expiring**. */
export const NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE = 3

/**
 * Discount percent applied when the expiration nudge cron runs (same code, higher offer).
 * Leftover 10% codes still bump to this; new 15% codes get the reminder without a further bump.
 */
export const NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT = 15

/** Delay before showing the visitor popup after landing. */
export const NEWSLETTER_POPUP_DELAY_MS = 4_000

/** Bumped with the 15% campaign so returning visitors see the new offer. */
export const NEWSLETTER_POPUP_STORAGE_KEY = "rw_newsletter_popup_state_v15"

export type NewsletterPopupStorageState = "dismissed" | "subscribed"
