/**
 * Maps Reswell listing `condition` values to Google Merchant Center `condition` attribute.
 *
 * Merchant API enum: NEW | USED | REFURBISHED (required for used/refurbished products).
 * @see https://support.google.com/merchants/answer/6324469
 */

export type GoogleMerchantCondition = "NEW" | "USED" | "REFURBISHED"

export type SchemaOrgItemCondition = "NewCondition" | "UsedCondition" | "RefurbishedCondition"

const NEW_CONDITION_VALUES = new Set(["brand_new", "new"])

const REFURBISHED_CONDITION_VALUES = new Set(["refurbished", "remanufactured"])

/** Reswell peer listings with any wear grade are second-hand for Google Shopping. */
const USED_CONDITION_VALUES = new Set([
  "like_new",
  "excellent",
  "very_good",
  "good",
  "fair",
  "poor",
])

function normalizeListingCondition(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase()
}

/**
 * Reswell → Google Merchant `condition` attribute.
 * Defaults to USED when unset — peer marketplace listings are overwhelmingly second-hand.
 */
export function mapListingConditionToGoogleMerchant(
  condition: string | null | undefined,
): GoogleMerchantCondition {
  const value = normalizeListingCondition(condition)
  if (!value) return "USED"
  if (NEW_CONDITION_VALUES.has(value)) return "NEW"
  if (REFURBISHED_CONDITION_VALUES.has(value)) return "REFURBISHED"
  if (USED_CONDITION_VALUES.has(value)) return "USED"
  return "USED"
}

/** Parallel schema.org itemCondition for JSON-LD on listing PDPs (feed ↔ page alignment). */
export function mapListingConditionToSchemaOrg(
  condition: string | null | undefined,
): SchemaOrgItemCondition {
  const merchant = mapListingConditionToGoogleMerchant(condition)
  if (merchant === "NEW") return "NewCondition"
  if (merchant === "REFURBISHED") return "RefurbishedCondition"
  return "UsedCondition"
}
