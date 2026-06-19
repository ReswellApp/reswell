import { MARKETPLACE_FEE_PERCENT } from "@/lib/seller-fees"

/**
 * Three-way money split for a consignment sale, computed from the **item price only**
 * (shipping is excluded — same rule as peer sales; it is collected separately and never
 * part of any party's earnings).
 *
 * Fee model (confirmed with product):
 *   • Shop commission is a percent of the item price (basis points), configurable per shop.
 *   • Reswell takes its fee (default 7%) out of the SHOP's commission — the consignor is
 *     unaffected by the Reswell fee.
 *
 *   shopCommissionGross = itemPrice × commissionBps / 10_000
 *   platformFee         = itemPrice × reswellFeeBps / 10_000
 *   shopNetEarnings     = shopCommissionGross − platformFee
 *   consignorEarnings   = itemPrice − shopCommissionGross
 *
 * Invariant (so existing settlement columns stay consistent):
 *   consignorEarnings + shopNetEarnings === itemPrice − platformFee === (peer) sellerEarnings
 */

/** Default Reswell platform fee for consignment, in basis points (mirrors {@link MARKETPLACE_FEE_PERCENT}). */
export const DEFAULT_RESWELL_FEE_BPS = MARKETPLACE_FEE_PERCENT * 100

/** A shop must take at least the Reswell fee so its net commission is never negative. */
export const MIN_SHOP_COMMISSION_BPS = DEFAULT_RESWELL_FEE_BPS

export type ConsignmentSplit = {
  itemPrice: number
  shopCommissionGross: number
  platformFee: number
  shopNetEarnings: number
  consignorEarnings: number
  /** consignorEarnings + shopNetEarnings; equals the peer-model sellerEarnings (item − fee). */
  sellerEarnings: number
}

export type ComputeConsignmentSplitResult =
  | { ok: true; split: ConsignmentSplit }
  | { ok: false; error: string }

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export type FloorCheckListing = {
  title?: string | null
  price: string | number
  floor_price?: string | number | null
  consignment_store_id?: string | null
}

export type ConsignmentFloorViolation = {
  title: string
  floorPrice: number
  salePrice: number
}

/**
 * Returns the first consignment listing whose effective sale price is below its consignor floor,
 * or null when every consigned item is at/above floor. Peer listings (no store id) are ignored.
 * `price` must be the effective sale price (e.g. after an accepted offer is applied).
 */
export function findConsignmentFloorViolation(
  listings: FloorCheckListing[],
): ConsignmentFloorViolation | null {
  for (const listing of listings) {
    if (!listing.consignment_store_id) continue
    if (listing.floor_price == null) continue

    const floorPrice = round2(parseFloat(String(listing.floor_price)))
    if (!Number.isFinite(floorPrice) || floorPrice <= 0) continue

    const salePrice = round2(parseFloat(String(listing.price)))
    if (!Number.isFinite(salePrice)) continue

    if (salePrice < floorPrice) {
      return {
        title: (listing.title ?? "").trim() || "this board",
        floorPrice,
        salePrice,
      }
    }
  }
  return null
}

/**
 * Resolves the effective commission rate (bps) for a listing, falling back to the store default.
 * Returns null when neither is a valid rate.
 */
export function resolveCommissionBps(
  listingCommissionBps: number | null | undefined,
  storeDefaultCommissionBps: number | null | undefined,
): number | null {
  const candidate =
    typeof listingCommissionBps === "number" && Number.isFinite(listingCommissionBps)
      ? listingCommissionBps
      : typeof storeDefaultCommissionBps === "number" && Number.isFinite(storeDefaultCommissionBps)
        ? storeDefaultCommissionBps
        : null
  if (candidate === null) return null
  return Math.round(candidate)
}

/**
 * Computes the consignor / shop / Reswell split for a single consigned item.
 * `commissionBps` is the resolved shop rate (use {@link resolveCommissionBps} first).
 */
export function computeConsignmentSplit(params: {
  itemPriceUsd: number
  commissionBps: number
  reswellFeeBps?: number
}): ComputeConsignmentSplitResult {
  const { itemPriceUsd, commissionBps } = params
  const reswellFeeBps = params.reswellFeeBps ?? DEFAULT_RESWELL_FEE_BPS

  if (!Number.isFinite(itemPriceUsd) || itemPriceUsd < 0) {
    return { ok: false, error: "Invalid item price" }
  }
  if (!Number.isFinite(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    return { ok: false, error: "Invalid commission rate" }
  }
  if (!Number.isFinite(reswellFeeBps) || reswellFeeBps < 0 || reswellFeeBps > 10_000) {
    return { ok: false, error: "Invalid platform fee rate" }
  }
  if (commissionBps < reswellFeeBps) {
    return {
      ok: false,
      error: "Shop commission must be at least the Reswell fee so the shop's net is not negative",
    }
  }

  const shopCommissionGross = round2((itemPriceUsd * commissionBps) / 10_000)
  const platformFee = round2((itemPriceUsd * reswellFeeBps) / 10_000)
  const shopNetEarnings = round2(shopCommissionGross - platformFee)
  const consignorEarnings = round2(itemPriceUsd - shopCommissionGross)
  const sellerEarnings = round2(consignorEarnings + shopNetEarnings)

  return {
    ok: true,
    split: {
      itemPrice: round2(itemPriceUsd),
      shopCommissionGross,
      platformFee,
      shopNetEarnings,
      consignorEarnings,
      sellerEarnings,
    },
  }
}
