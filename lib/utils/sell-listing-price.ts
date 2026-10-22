/** Listing price bounds shared by sell validation, completion, and draft rows. */
export const SELL_LISTING_PRICE_MIN = 0.01
export const SELL_LISTING_PRICE_MAX = 999_999.99

const PRICE_INPUT_IDS = ["sell-listing-price", "quick-listing-price"] as const

function roundUsd(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Parse a sell-form price. Accepts a number or text with a leading `$`,
 * thousands separators, and surrounding spaces (`$1,200.50`).
 * Returns null for empty or non-numeric input. Does not enforce min/max.
 */
export function parseSellListingPrice(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null
    return roundUsd(raw)
  }
  if (typeof raw !== "string") return null
  const stripped = raw.trim().replace(/[$,\s]/g, "")
  if (!stripped || !/^(?:\d+\.?\d*|\.\d+)$/.test(stripped)) return null
  const amount = Number.parseFloat(stripped)
  if (!Number.isFinite(amount)) return null
  return roundUsd(amount)
}

export function sellListingPriceIsPublishable(raw: unknown): boolean {
  const amount = parseSellListingPrice(raw)
  return amount != null && amount >= SELL_LISTING_PRICE_MIN && amount <= SELL_LISTING_PRICE_MAX
}

export const LISTING_NEEDS_PRICE_BEFORE_LIVE =
  "Listing needs a price before it can go live."

/** Server publish gate. Accepts `49.95`, `"49.95"`, and `"$49.95"`. */
export function draftListingPriceBlockReason(raw: unknown): string | null {
  const price = parseSellListingPrice(raw)
  if (price == null || price < SELL_LISTING_PRICE_MIN) {
    return LISTING_NEEDS_PRICE_BEFORE_LIVE
  }
  return null
}

export function sellListingPriceValidationMessage(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim().replace(/[$,\s]/g, "") : raw
  const empty =
    raw == null ||
    raw === "" ||
    (typeof raw === "string" && text === "")
  if (empty) return "Enter a listing price."
  if (!sellListingPriceIsPublishable(raw)) {
    return `Enter a valid price between $${SELL_LISTING_PRICE_MIN} and $${SELL_LISTING_PRICE_MAX.toLocaleString()}.`
  }
  return null
}

/**
 * Strip `$` and thousands separators so `z.coerce.number()` sees a plain amount.
 * Non-strings pass through for Zod to reject.
 */
export function coerceSellListingPriceInput(value: unknown): unknown {
  if (typeof value === "number" || typeof value !== "string") return value
  return value.trim().replace(/[$,\s]/g, "")
}

/**
 * Price to check before a draft goes live, and the number to store when the
 * submit included one. Form text (`"49.95"`, `"$49.95"`) wins over a draft
 * row still at 0. An explicit 0 stays 0 so publish still requires a real price.
 * When the submit does not parse, returns the stored price and leaves `fields` alone.
 */
export function applyDraftPublishPrice(
  fields: Record<string, unknown>,
  existingPrice: unknown,
): number | null {
  const submitted = parseSellListingPrice(fields.price)
  if (submitted != null) {
    fields.price = submitted
    return submitted
  }
  return parseSellListingPrice(existingPrice)
}

/**
 * Prefer React state when it already parses. Otherwise read a mounted price
 * input — Chrome autofill can paint a value without firing `onChange`.
 */
export function readLiveSellListingPrice(statePrice: unknown): string {
  const stateText =
    typeof statePrice === "string" ? statePrice : statePrice == null ? "" : String(statePrice)
  if (parseSellListingPrice(stateText) != null) return stateText
  if (typeof document === "undefined") return stateText
  for (const id of PRICE_INPUT_IDS) {
    const el = document.getElementById(id)
    if (!(el instanceof HTMLInputElement)) continue
    if (parseSellListingPrice(el.value) != null) return el.value
  }
  return stateText
}
