/** Shipping cost modes sellers may pick. Flat/free are admin-only. */
export type SellShippingCostMode = "reswell" | "flat" | "free"

export type ListingPersistShippingOptions = {
  /** When true, free/flat modes are kept. Default false → Reswell only. */
  allowPrivilegedShippingModes?: boolean
}

/**
 * Non-admins may only use Reswell-calculated shipping.
 * Admins (and admin impersonation edits) may set flat dollar rates or free shipping.
 */
export function normalizeSellShippingCostMode(
  mode: SellShippingCostMode | null | undefined,
  allowPrivilegedModes: boolean,
): SellShippingCostMode {
  const resolved = mode === "flat" || mode === "free" || mode === "reswell" ? mode : "reswell"
  if (allowPrivilegedModes) return resolved
  return "reswell"
}
