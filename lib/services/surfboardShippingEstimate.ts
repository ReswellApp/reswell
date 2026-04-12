import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { formatShipEngineApiError } from "@/lib/shipengine/errors"
import {
  buildShipmentBody,
  extractCarrierIdsFromCarriersResponse,
  extractRatesFromApiEnvelope,
  rateMoneyTotal,
} from "@/lib/shipping/shipengine-rate-helpers"
import type { SurfboardShippingEstimateInput } from "@/lib/validations/surfboard-shipping-estimate"

export type PublicShippingRateRow = {
  totalAmount: number
  currency: string
  carrierName: string
  /** ShipEngine carrier code (e.g. ups, fedex_walleted) for UI hints. */
  carrierCode: string | null
  serviceName: string
  deliveryDays: number | null
  /** ShipEngine `rate_attributes` (e.g. cheapest, fastest, best_value). */
  attributes: string[]
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return t
  }
}

async function fetchCarrierIds(): Promise<string[]> {
  const res = await shipEngineRequest("/carriers")
  const data = await parseJsonSafe(res)
  if (!res.ok) {
    const hint = formatShipEngineApiError(data)
    throw new Error(
      hint ||
        (typeof data === "string" ? data : "Could not load carriers from ShipEngine"),
    )
  }
  return extractCarrierIdsFromCarriersResponse(data)
}

/**
 * Returns carrier rate options for a packed surfboard (same ShipEngine `/rates` flow as admin).
 */
export async function getTopSurfboardShippingRates(
  input: SurfboardShippingEstimateInput,
  opts?: { topN?: number },
): Promise<{ ok: true; rates: PublicShippingRateRow[] } | { ok: false; error: string }> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Shipping quotes are temporarily unavailable." }
  }

  const topN = Math.min(30, Math.max(1, opts?.topN ?? 20))

  let carrierIds: string[]
  try {
    carrierIds = await fetchCarrierIds()
  } catch (e) {
    console.error("[surfboardShippingEstimate] carriers:", e)
    return { ok: false, error: "Could not load carrier accounts. Try again later." }
  }

  if (carrierIds.length === 0) {
    return { ok: false, error: "No shipping carriers are configured yet." }
  }

  const payload = {
    rate_options: { carrier_ids: carrierIds },
    shipment: buildShipmentBody(input.shipFrom, input.shipTo, {
      weightValue: input.weightOz,
      weightUnit: "ounce",
      length: input.lengthIn,
      width: input.widthIn,
      height: input.heightIn,
      dimUnit: "inch",
      packageCode: "package",
      validateAddress: "no_validation",
    }),
  }

  let res: Response
  try {
    res = await shipEngineRequest("/rates", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.error("[surfboardShippingEstimate] rates request:", e)
    return { ok: false, error: "Could not reach the shipping rate service." }
  }

  const raw = await parseJsonSafe(res)
  if (!res.ok) {
    const msg = formatShipEngineApiError(raw)
    console.error("[surfboardShippingEstimate] rates HTTP:", res.status, raw)
    return {
      ok: false,
      error: msg.trim() || "ShipEngine did not return rates for this package.",
    }
  }

  const rates = extractRatesFromApiEnvelope(raw)
  if (rates.length === 0) {
    const emptyHint = formatShipEngineApiError(raw)
    if (emptyHint.trim()) {
      console.error("[surfboardShippingEstimate] rates empty with API hints:", raw)
      return { ok: false, error: emptyHint.trim() }
    }
  }

  const decorated = rates.map((r) => {
    const { total, currency } = rateMoneyTotal(r)
    return {
      total,
      currency,
      r,
    }
  })

  decorated.sort((a, b) => a.total - b.total)

  const top = decorated.slice(0, topN).map(({ r, total, currency }) => {
    const attrs = Array.isArray(r.rate_attributes)
      ? (r.rate_attributes as string[]).filter((x): x is string => typeof x === "string")
      : []
    const codeRaw = r.carrier_code
    return {
      totalAmount: total,
      currency: currency.toUpperCase(),
      carrierName: String(r.carrier_friendly_name ?? r.carrier_code ?? "Carrier"),
      carrierCode: typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim() : null,
      serviceName: String(r.service_type ?? r.service_code ?? "Service"),
      deliveryDays:
        typeof r.delivery_days === "number" && Number.isFinite(r.delivery_days)
          ? r.delivery_days
          : null,
      attributes: attrs,
    }
  })

  return { ok: true, rates: top }
}
