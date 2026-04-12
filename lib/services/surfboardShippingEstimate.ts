import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
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
  serviceName: string
  deliveryDays: number | null
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
    throw new Error(
      typeof data === "string" ? data : "Could not load carriers from ShipEngine",
    )
  }
  return extractCarrierIdsFromCarriersResponse(data)
}

/**
 * Returns the three lowest-priced carrier options for a packed surfboard (same logic as admin calculator).
 */
export async function getTopSurfboardShippingRates(
  input: SurfboardShippingEstimateInput,
  opts?: { topN?: number },
): Promise<{ ok: true; rates: PublicShippingRateRow[] } | { ok: false; error: string }> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Shipping quotes are temporarily unavailable." }
  }

  const topN = opts?.topN ?? 3

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
    const msg =
      raw != null && typeof raw === "object" && "message" in raw
        ? String((raw as { message?: unknown }).message ?? "")
        : ""
    console.error("[surfboardShippingEstimate] rates HTTP:", res.status, raw)
    return {
      ok: false,
      error: msg.trim() || "ShipEngine did not return rates for this package.",
    }
  }

  const rates = extractRatesFromApiEnvelope(raw)
  const decorated = rates.map((r) => {
    const { total, currency } = rateMoneyTotal(r)
    return {
      total,
      currency,
      r,
    }
  })

  decorated.sort((a, b) => a.total - b.total)

  const top = decorated.slice(0, topN).map(({ r, total, currency }) => ({
    totalAmount: total,
    currency: currency.toUpperCase(),
    carrierName: String(r.carrier_friendly_name ?? r.carrier_code ?? "Carrier"),
    serviceName: String(r.service_type ?? r.service_code ?? "Service"),
    deliveryDays:
      typeof r.delivery_days === "number" && Number.isFinite(r.delivery_days)
        ? r.delivery_days
        : null,
  }))

  return { ok: true, rates: top }
}
