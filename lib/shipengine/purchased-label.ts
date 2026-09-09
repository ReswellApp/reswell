function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

export function moneyFromShipEngineAmount(value: unknown): number {
  const rec = asRecord(value)
  const raw = rec ? rec.amount : value
  const amount = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(amount) ? amount : 0
}

export type ShipEnginePurchasedLabel = {
  labelId: string
  shipmentId: string | null
  trackingNumber: string | null
  carrierCode: string | null
  serviceCode: string | null
  createdAt: string
  voided: boolean
  isReturnLabel: boolean
  postageUsd: number
  insuranceUsd: number
}

export function purchasedLabelFromApi(row: Record<string, unknown>): ShipEnginePurchasedLabel | null {
  const labelId = typeof row.label_id === "string" ? row.label_id.trim() : ""
  if (!labelId) return null

  const createdAt = typeof row.created_at === "string" ? row.created_at : ""
  const tracking =
    typeof row.tracking_number === "string" ? row.tracking_number.trim() || null : null
  const shipmentId = typeof row.shipment_id === "string" ? row.shipment_id : null
  const carrierCode =
    typeof row.carrier_code === "string" ? row.carrier_code.trim() || null : null
  const serviceCode =
    typeof row.service_code === "string" ? row.service_code.trim() || null : null

  return {
    labelId,
    shipmentId,
    trackingNumber: tracking,
    carrierCode,
    serviceCode,
    createdAt,
    voided: row.voided === true,
    isReturnLabel: row.is_return_label === true,
    postageUsd: moneyFromShipEngineAmount(row.shipment_cost),
    insuranceUsd: moneyFromShipEngineAmount(row.insurance_cost),
  }
}

/** Postage + insurance. Voided labels are treated as $0 (refunded to ShipEngine). */
export function chargeUsdForPurchasedLabel(label: ShipEnginePurchasedLabel): number {
  if (label.voided) return 0
  return label.postageUsd + label.insuranceUsd
}
