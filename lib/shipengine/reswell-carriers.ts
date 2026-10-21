/**
 * ShipEngine One Balance accounts. Checkout quotes, estimates, and label rates
 * use only these carrier ids — never a personally connected UPS account.
 */
export const SHIPENGINE_WALLET_CARRIERS = [
  { id: "se-6296410", label: "USPS" },
  { id: "se-6296414", label: "UPS" },
  { id: "se-6296416", label: "FedEx One Balance" },
  { id: "se-6296418", label: "GlobalPost" },
] as const

export type ShipEngineWalletCarrierId = (typeof SHIPENGINE_WALLET_CARRIERS)[number]["id"]

export const SHIPENGINE_WALLET_CARRIER_IDS: readonly ShipEngineWalletCarrierId[] =
  SHIPENGINE_WALLET_CARRIERS.map((carrier) => carrier.id)

const SHIPENGINE_WALLET_CARRIER_ID_SET = new Set<string>(SHIPENGINE_WALLET_CARRIER_IDS)

export function isShipEngineWalletCarrierId(carrierId: string | null | undefined): boolean {
  return SHIPENGINE_WALLET_CARRIER_ID_SET.has((carrierId ?? "").trim())
}

/** Keep allowlist order. Drop every other ShipEngine connection. */
export function filterToShipEngineWalletCarrierIds(carrierIds: readonly string[]): string[] {
  const present = new Set(carrierIds.map((id) => id.trim()).filter((id) => id.length > 0))
  return SHIPENGINE_WALLET_CARRIER_IDS.filter((id) => present.has(id))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

/**
 * Force a ShipEngine `/rates` body onto the One Balance allowlist.
 * A missing `carrier_ids` list becomes the full allowlist so ShipEngine cannot
 * quote every account on the key.
 */
export function restrictShipEngineRatesPayload(
  payload: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const next: Record<string, unknown> = { ...payload }
  const rateOptions = asRecord(next.rate_options)
  const rawIds = rateOptions?.carrier_ids
  const requested = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string")
    : []
  const carrierIds =
    requested.length > 0
      ? filterToShipEngineWalletCarrierIds(requested)
      : [...SHIPENGINE_WALLET_CARRIER_IDS]

  if (carrierIds.length === 0) {
    return {
      ok: false,
      error:
        "Rates can only use the ShipEngine One Balance carriers (USPS, UPS, FedEx, GlobalPost).",
    }
  }

  next.rate_options = { ...(rateOptions ?? {}), carrier_ids: carrierIds }

  const shipmentCarrier = readShipmentCarrierId(next.shipment)
  if (shipmentCarrier && !isShipEngineWalletCarrierId(shipmentCarrier)) {
    return {
      ok: false,
      error: "Rates can only use the ShipEngine One Balance carriers (USPS, UPS, FedEx, GlobalPost).",
    }
  }

  return { ok: true, payload: next }
}

/** Reject a label body that names a carrier outside the One Balance allowlist. */
export function restrictShipEngineLabelPayload(
  payload: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const shipmentCarrier = readShipmentCarrierId(payload.shipment)
  if (shipmentCarrier && !isShipEngineWalletCarrierId(shipmentCarrier)) {
    return {
      ok: false,
      error: "Labels can only be bought on the ShipEngine One Balance carriers.",
    }
  }

  const rateOptions = asRecord(payload.rate_options)
  const rawIds = rateOptions?.carrier_ids
  if (!Array.isArray(rawIds)) return { ok: true, payload }

  const carrierIds = filterToShipEngineWalletCarrierIds(
    rawIds.filter((id): id is string => typeof id === "string"),
  )
  if (carrierIds.length === 0) {
    return {
      ok: false,
      error: "Labels can only be bought on the ShipEngine One Balance carriers.",
    }
  }

  return {
    ok: true,
    payload: {
      ...payload,
      rate_options: { ...rateOptions, carrier_ids: carrierIds },
    },
  }
}

function readShipmentCarrierId(shipment: unknown): string | null {
  const row = asRecord(shipment)
  const id = row?.carrier_id
  return typeof id === "string" && id.trim() ? id.trim() : null
}

/**
 * Legacy personally connected UPS account. Not used for quotes or new labels.
 * Postage recovery still uses it to tell an old UPS-invoice label from a
 * ShipEngine balance label.
 */
export const RESWELL_UPS_CARRIER_ID_DEFAULT = "se-6450247"

/** Matches {@link getReswellUpsCarrierId} unless the server env overrides it. */
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
