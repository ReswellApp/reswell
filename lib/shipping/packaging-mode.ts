/**
 * Same-seller multi-item shipping: one combined carton vs one package per line.
 *
 * Physical packages are modeled as `order_shipments` (1 together / N separate).
 * Carrier tracking, labels, and delivery clocks live on shipments; orders roll up.
 */

import {
  countSurfboardListings,
  surfboardsRequireSeparatePackages,
} from "@/lib/surfboard-multi-board-parcel"

export const SHIPPING_PACKAGING_MODES = ["together", "separate"] as const

export type ShippingPackagingMode = (typeof SHIPPING_PACKAGING_MODES)[number]

export const DEFAULT_SHIPPING_PACKAGING_MODE: ShippingPackagingMode = "together"

/**
 * Legacy ShipEngine lock key for one-box labels before shipments existed.
 * New purchases use `order_shipments.id` as package_key.
 */
export const TOGETHER_PACKAGE_KEY = "together"

export function parseShippingPackagingMode(
  value: unknown,
): ShippingPackagingMode | null {
  if (value === "together" || value === "separate") return value
  return null
}

export function resolveShippingPackagingMode(
  value: unknown,
  fallback: ShippingPackagingMode = DEFAULT_SHIPPING_PACKAGING_MODE,
): ShippingPackagingMode {
  return parseShippingPackagingMode(value) ?? fallback
}

/**
 * Buyer may choose together vs separate when checking out 2–3 surfboards
 * that all offer shipping (peer surfboards only — shop mix stays one-box).
 * Four or more surfboards skip the choice and ship as separate packages.
 */
export function checkoutOffersShippingPackagingChoice(listings: Array<{
  section?: string | null
  shipping_available?: boolean | null
}>): boolean {
  if (listings.length < 2) return false
  if (!listings.every((l) => !!l.shipping_available)) return false
  if (surfboardsRequireSeparatePackages(countSurfboardListings(listings))) return false
  return listings.every((l) => l.section?.trim() === "surfboards")
}

/**
 * Packaging for a same-seller checkout.
 * Four or more surfboards always ship as one package per board. Two or three
 * surfboards follow the buyer's together/separate choice. Pickup ignores packaging.
 */
export function resolveMultiItemPackagingMode(input: {
  listings: Array<{ section?: string | null; shipping_available?: boolean | null }>
  requested?: unknown
  fulfillment: "pickup" | "shipping"
}): ShippingPackagingMode {
  if (input.fulfillment !== "shipping") return DEFAULT_SHIPPING_PACKAGING_MODE
  if (surfboardsRequireSeparatePackages(countSurfboardListings(input.listings))) {
    return "separate"
  }
  const requested = parseShippingPackagingMode(input.requested)
  if (checkoutOffersShippingPackagingChoice(input.listings) && requested === "separate") {
    return "separate"
  }
  return DEFAULT_SHIPPING_PACKAGING_MODE
}
