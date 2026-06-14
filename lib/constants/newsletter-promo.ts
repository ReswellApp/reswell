/** Newsletter welcome offer — Reswell absorbs the discount; sellers receive full item earnings. */

export const NEWSLETTER_PROMO_DISCOUNT_PERCENT = 10

/** Days until a generated code expires. */
export const NEWSLETTER_PROMO_VALIDITY_DAYS = 30

/** Delay before showing the visitor popup after landing. */
export const NEWSLETTER_POPUP_DELAY_MS = 4_000

export const NEWSLETTER_POPUP_STORAGE_KEY = "rw_newsletter_popup_state"

export type NewsletterPopupStorageState = "dismissed" | "subscribed"
