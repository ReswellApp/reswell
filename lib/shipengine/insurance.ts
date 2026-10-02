/**
 * ShipEngine ParcelGuard / insurance helpers for marketplace labels.
 * Claims are filed via portal URL — there is no ShipEngine "file claim" API.
 *
 * Reswell does not buy ShipEngine insurance (ParcelGuard, Shipsurance, carrier,
 * or third-party). Rate quotes and label purchases send `insurance_provider: none`.
 * `SHIPENGINE_LABEL_INSURANCE_ENABLED` is ignored so a leftover env value cannot
 * add insurance back onto shipping.
 */

export function isShipEngineLabelInsuranceEnabled(): boolean {
  return false
}

/** Shipment fields for rate quotes and label purchases. Insurance is never bought. */
export function shipEngineShipmentInsurance(): { insurance_provider: "none" } {
  return { insurance_provider: "none" }
}

export function pickInsuranceClaimUrl(label: Record<string, unknown>): string | null {
  const claim = label.insurance_claim
  if (claim != null && typeof claim === "object" && !Array.isArray(claim)) {
    const href = (claim as { href?: unknown }).href
    if (typeof href === "string" && href.trim()) return href.trim()
  }
  if (typeof label.insurance_claim_url === "string" && label.insurance_claim_url.trim()) {
    return label.insurance_claim_url.trim()
  }
  return null
}

export function pickInsuranceCost(label: Record<string, unknown>): {
  amount: number | null
  currency: string | null
} {
  const cost = label.insurance_cost
  if (cost != null && typeof cost === "object" && !Array.isArray(cost)) {
    const c = cost as { amount?: unknown; currency?: unknown }
    const amount = typeof c.amount === "number" ? c.amount : Number(c.amount)
    return {
      amount: Number.isFinite(amount) ? amount : null,
      currency: typeof c.currency === "string" ? c.currency : "usd",
    }
  }
  return { amount: null, currency: null }
}

export function pickShipEngineLabelIds(label: Record<string, unknown>): {
  labelId: string | null
  shipmentId: string | null
} {
  return {
    labelId: typeof label.label_id === "string" && label.label_id.trim() ? label.label_id.trim() : null,
    shipmentId:
      typeof label.shipment_id === "string" && label.shipment_id.trim()
        ? label.shipment_id.trim()
        : null,
  }
}
