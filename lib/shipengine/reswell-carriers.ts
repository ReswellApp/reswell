/** Reswell UPS account connected in ShipEngine (My Carrier Accounts). */
export const RESWELL_UPS_CARRIER_ID_DEFAULT = "se-6450247"

/** Used by admin shipping UI; matches {@link getReswellUpsCarrierId} unless env override is server-only. */
export const RESWELL_UPS_CARRIER_ID = RESWELL_UPS_CARRIER_ID_DEFAULT

export function isReswellUpsCarrierId(carrierId: string | null | undefined): boolean {
  return (carrierId ?? "").trim() === RESWELL_UPS_CARRIER_ID
}

export function isReswellUpsCarrier(carrier: { carrier_id?: unknown }): boolean {
  const id = typeof carrier.carrier_id === "string" ? carrier.carrier_id.trim() : ""
  return isReswellUpsCarrierId(id)
}

export function findReswellUpsCarrier(
  carriers: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
  return carriers.find(isReswellUpsCarrier) ?? null
}

export function reswellUpsCarrierLabel(carrier: Record<string, unknown> | null): string {
  if (!carrier) return "Reswell UPS"
  const name = carrier.friendly_name ?? carrier.nickname ?? carrier.description
  if (typeof name === "string" && name.trim()) return name.trim()
  return "Reswell UPS"
}
