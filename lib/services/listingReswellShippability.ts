import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import {
  resolvePackedParcelFromListing,
  type ListingPackedParcelSource,
} from "@/lib/reswell-packed-parcel-from-listing"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"

/** Listing slice required to decide whether Reswell carrier rating can run at checkout. */
export type ListingReswellShippabilityInput = ListingPackedParcelSource & {
  section?: string | null
  shipping_available?: boolean | null
  board_shipping_cost_mode?: string | null
  shipping_price?: string | number | null
  local_pickup?: boolean | null
}

export type ListingCheckoutFulfillmentFlags = {
  canPick: boolean
  canShip: boolean
  /** DB has shipping on, but Reswell parcel cannot be resolved (legacy / incomplete listing). */
  shippingConfiguredButBroken: boolean
}

/** Buyer-facing message when shipping is advertised but carrier rating cannot run. */
export const LISTING_RESELL_SHIPPING_UNAVAILABLE_MESSAGE =
  "Shipping is temporarily unavailable for this listing — the seller needs to update board dimensions and Reswell shipping on their listing."

export function listingUsesReswellCarrierQuote(input: ListingReswellShippabilityInput): boolean {
  if (!input.shipping_available) return false
  return effectiveBoardShippingMode(input) === "reswell"
}

export function resolveListingReswellParcel(
  input: ListingReswellShippabilityInput,
): { ok: true } | { ok: false; error: string } {
  const resolved = resolvePackedParcelFromListing(input)
  if (resolved.ok) return { ok: true }
  return { ok: false, error: resolved.error }
}

/**
 * Whether a buyer can choose carrier shipping at checkout.
 * Flat/free modes do not need a Reswell parcel; Reswell mode must resolve L×W×H + weight.
 */
export function listingBuyerShippingQuoteable(input: ListingReswellShippabilityInput): boolean {
  if (!input.shipping_available) return false
  if (!listingUsesReswellCarrierQuote(input)) return true
  return resolveListingReswellParcel(input).ok
}

export function getListingCheckoutFulfillmentFlags(
  input: ListingReswellShippabilityInput,
): ListingCheckoutFulfillmentFlags {
  const canPick = input.local_pickup !== false
  const shippingRaw = !!input.shipping_available
  const canShip = shippingRaw && listingBuyerShippingQuoteable(input)
  return {
    canPick,
    canShip,
    shippingConfiguredButBroken: shippingRaw && !canShip,
  }
}

/** True when surfboard row has board L×W×T persisted on `listings.dimensions`. */
export function surfboardListingHasRequiredBoardDimensions(dimensions: string | null | undefined): boolean {
  const parsed = dimensions?.trim() ? parseListingDimensionsColumn(dimensions) : null
  if (!parsed?.boardLength?.trim()) return false
  if (!parsed.boardWidthInches?.trim()) return false
  if (!parsed.boardThicknessInches?.trim()) return false
  return true
}

export type CheckoutListingShippingMeta = {
  /** Buyer can choose carrier shipping (Reswell parcel resolves when required). */
  shipping_quoteable: boolean
  /** DB advertises shipping but carrier rating cannot run. */
  shipping_configured_but_broken: boolean
}

export function checkoutListingShippingMeta(
  input: ListingReswellShippabilityInput,
): CheckoutListingShippingMeta {
  const flags = getListingCheckoutFulfillmentFlags(input)
  return {
    shipping_quoteable: flags.canShip,
    shipping_configured_but_broken: flags.shippingConfiguredButBroken,
  }
}
