/**
 * Reswell-owned retail shop (`listings.section = 'new'`).
 * Managed by any Reswell admin via `/admin/shop`. Owned by the dedicated
 * platform profile (`RESWELL_SHOP_OWNER_USER_ID` / shop@reswell.app) — never a
 * personal seller. Lives only on `/reswell/shop` (not peer marketplace,
 * consignment, or seller profiles). Distinct from peer fee waiver
 * (`profiles.is_reswell_seller`).
 */

export const RESWELL_SHOP_SECTION = "new" as const

export function isReswellShopListing(section: string | null | undefined): boolean {
  return section === RESWELL_SHOP_SECTION
}

/**
 * Shop lines have no marketplace fee and no peer seller wallet credit.
 * Reswell retains the full item price as retail revenue.
 */
export function getReswellShopLineEarnings(unitPriceUsd: number, quantity: number): {
  itemPrice: number
  lineTotal: number
  platformFee: number
  sellerEarnings: number
} {
  const unit = Math.round(unitPriceUsd * 100) / 100
  const qty = Math.max(1, Math.floor(quantity))
  const lineTotal = Math.round(unit * qty * 100) / 100
  return {
    itemPrice: unit,
    lineTotal,
    platformFee: 0,
    sellerEarnings: 0,
  }
}
