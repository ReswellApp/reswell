/** Shipping cost modes sellers may pick on a listing. */
export type SellShippingCostMode = "reswell" | "flat" | "free"

export type ListingPersistShippingOptions = {
  /**
   * @deprecated Free/flat are available to all sellers. Kept for call-site compat; ignored.
   */
  allowPrivilegedShippingModes?: boolean
}

/**
 * Resolve listing shipping cost mode. Defaults to Reswell when unset/invalid.
 * Free and flat are available to all sellers.
 */
export function normalizeSellShippingCostMode(
  mode: SellShippingCostMode | null | undefined,
  _allowPrivilegedModes?: boolean,
): SellShippingCostMode {
  if (mode === "flat" || mode === "free" || mode === "reswell") return mode
  return "reswell"
}
