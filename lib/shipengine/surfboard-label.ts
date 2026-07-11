import { shipEngineRequest } from "@/lib/shipengine/client"
import { getShipEngineLabelImageId, isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  formatShipEngineApiError,
  isLabelImagesNotSupportedError,
} from "@/lib/shipengine/errors"
import {
  buildShipEngineRateShipment,
  type RateQuoteAddressFields,
} from "@/lib/shipping/rate-address"
import {
  extractRatesFromApiEnvelope,
  rateMoneyTotal,
} from "@/lib/shipping/shipengine-rate-helpers"
import { validateSurfboardLabelParcelLimits } from "@/lib/shipping/surfboard-label-limits"

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
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

export type ShipEngineRateOption = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
}

export function normalizeShipEngineRatesForUi(rates: Record<string, unknown>[]): ShipEngineRateOption[] {
  const out: ShipEngineRateOption[] = []
  for (const r of rates) {
    const rateId = typeof r.rate_id === "string" ? r.rate_id : null
    if (!rateId) continue
    const carrierLabel =
      typeof r.carrier_friendly_name === "string"
        ? r.carrier_friendly_name
        : typeof r.carrier_code === "string"
          ? r.carrier_code
          : "Carrier"
    const serviceName =
      typeof r.service_type === "string"
        ? r.service_type
        : typeof r.service_code === "string"
          ? r.service_code
          : "Standard"
    const { total, currency } = rateMoneyTotal(r)
    out.push({
      rate_id: rateId,
      carrierLabel,
      serviceName,
      amount: total,
      currency: currency.toUpperCase(),
    })
  }
  out.sort((a, b) => a.amount - b.amount)
  return out
}

async function fetchCarrierIds(): Promise<string[]> {
  const res = await shipEngineRequest("/carriers")
  const data = await parseJsonSafe(res)
  const arr = Array.isArray(data)
    ? data
    : (() => {
        const r = asRecord(data)
        const c = r?.carriers
        return Array.isArray(c) ? c : []
      })()
  const ids: string[] = []
  for (const c of arr) {
    const row = asRecord(c)
    const id = row && typeof row.carrier_id === "string" ? row.carrier_id.trim() : ""
    if (id) ids.push(id)
  }
  return ids
}

export async function fetchShipEngineRatesForSurfboard(params: {
  shipFrom: RateQuoteAddressFields
  shipTo: RateQuoteAddressFields
  parcel: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number }
}): Promise<
  | { ok: true; rates: ShipEngineRateOption[] }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return {
      ok: false,
      error: "Label purchasing is not available right now. Contact support.",
      status: 503,
    }
  }

  const limitCheck = validateSurfboardLabelParcelLimits({
    lengthIn: params.parcel.lengthIn,
    weightLb: params.parcel.weightLb,
  })
  if (!limitCheck.ok) {
    return { ok: false, error: limitCheck.error, status: 422 }
  }

  const carrierIds = await fetchCarrierIds()
  if (!carrierIds.length) {
    return {
      ok: false,
      error: "No shipping carriers are available right now. Try again later or contact support.",
      status: 422,
    }
  }

  const shipment = buildShipEngineRateShipment(params.shipFrom, params.shipTo, {
    weightValue: params.parcel.weightLb,
    weightUnit: "pound",
    length: params.parcel.lengthIn,
    width: params.parcel.widthIn,
    height: params.parcel.heightIn,
    dimUnit: "inch",
    packageCode: "package",
    validateAddress: "no_validation",
  })

  const body = {
    rate_options: { carrier_ids: carrierIds },
    shipment,
  }

  const res = await shipEngineRequest("/rates", {
    method: "POST",
    body: JSON.stringify(body),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) {
    const msg =
      typeof data === "object" && data
        ? JSON.stringify(data).slice(0, 600)
        : "Could not get carrier rates for this shipment"
    return { ok: false, error: msg, status: res.status >= 400 ? res.status : 502 }
  }

  const rawRates = extractRatesFromApiEnvelope(data)
  const rates = normalizeShipEngineRatesForUi(rawRates)
  if (!rates.length) {
    return {
      ok: false,
      error: "No carrier rates returned for this route. Check addresses and parcel size.",
      status: 422,
    }
  }
  return { ok: true, rates }
}

/**
 * Look up a previously quoted rate by id (GET /v1/rates/{rate_id}). Quote requests
 * mint new rate ids every time, so re-quoting can never re-find a selected rate —
 * this is the only reliable way to validate a rate the user already picked.
 */
export async function getShipEngineRateById(rateId: string): Promise<
  | { ok: true; rate: ShipEngineRateOption }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Label printing is not configured.", status: 503 }
  }

  const trimmed = rateId.trim()
  if (!trimmed) {
    return { ok: false, error: "Missing carrier rate.", status: 400 }
  }

  const res = await shipEngineRequest(`/rates/${encodeURIComponent(trimmed)}`)
  const data = await parseJsonSafe(res)

  if (!res.ok) {
    if (res.status === 404) {
      return {
        ok: false,
        error: "That carrier rate expired or is invalid. Refresh rates and try again.",
        status: 400,
      }
    }
    const msg =
      formatShipEngineApiError(data) ||
      (typeof data === "object" && data
        ? JSON.stringify(data).slice(0, 600)
        : "Could not look up the carrier rate")
    return { ok: false, error: msg, status: res.status >= 400 ? res.status : 502 }
  }

  const row = asRecord(data)
  if (!row) {
    return { ok: false, error: "Could not look up the carrier rate.", status: 502 }
  }

  const [rate] = normalizeShipEngineRatesForUi([row])
  if (!rate || rate.rate_id !== trimmed || !(rate.amount > 0)) {
    return {
      ok: false,
      error: "That carrier rate expired or is invalid. Refresh rates and try again.",
      status: 400,
    }
  }

  return { ok: true, rate }
}

export type PurchasedShipEngineLabelResult = {
  labelUrl: string | null
  trackingNumber: string
  trackingCarrier: string
  costAmount: number | null
  costCurrency: string | null
}

/** ShipEngine returns the carrier charge as shipment_cost { amount, currency }. */
function pickLabelCost(label: Record<string, unknown>): {
  amount: number | null
  currency: string | null
} {
  const cost = asRecord(label.shipment_cost)
  if (!cost) return { amount: null, currency: null }
  const amount = typeof cost.amount === "number" ? cost.amount : Number(cost.amount)
  const currency = typeof cost.currency === "string" ? cost.currency.toUpperCase() : null
  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency,
  }
}

function pickLabelPdfUrl(label: Record<string, unknown>): string | null {
  const ld = asRecord(label.label_download)
  if (!ld) return null
  if (typeof ld.href === "string" && ld.href.startsWith("http")) return ld.href
  const pdf = asRecord(ld.pdf)
  if (pdf && typeof pdf.url === "string") return pdf.url
  const png = asRecord(ld.png)
  if (png && typeof png.url === "string") return png.url
  return null
}

/** ShipEngine sometimes nests tracking on packages[] or shipment. */
function extractTrackingNumberFromLabel(label: Record<string, unknown>): string {
  const direct = label.tracking_number
  if (typeof direct === "string" && direct.trim()) return direct.trim()

  const pkgs = label.packages
  if (Array.isArray(pkgs)) {
    for (const p of pkgs) {
      const row = asRecord(p)
      if (!row) continue
      const tn =
        typeof row.tracking_number === "string"
          ? row.tracking_number
          : typeof row.trackingNumber === "string"
            ? row.trackingNumber
            : null
      if (tn?.trim()) return tn.trim()
    }
  }

  const shipment = asRecord(label.shipment)
  if (shipment) {
    const st =
      typeof shipment.tracking_number === "string"
        ? shipment.tracking_number
        : typeof shipment.trackingNumber === "string"
          ? shipment.trackingNumber
          : null
    if (st?.trim()) return st.trim()
  }

  return ""
}

function pickTrackingCarrierLabel(label: Record<string, unknown>): string {
  const carrier =
    typeof label.carrier_code === "string"
      ? label.carrier_code
      : typeof label.carrier_id === "string"
        ? label.carrier_id
        : ""
  const svc =
    typeof label.service_code === "string"
      ? label.service_code
      : typeof label.service_type === "string"
        ? label.service_type
        : ""
  const parts = [carrier, svc].filter((p) => p.trim().length > 0)
  return parts.length ? parts.join(" · ") : "Carrier"
}

function buildShipEngineLabelPurchaseBody(includeLabelImage: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    label_format: "pdf",
    label_download_type: "url",
    label_layout: "4x6",
  }
  if (includeLabelImage) {
    const labelImageId = getShipEngineLabelImageId()
    if (labelImageId) body.label_image_id = labelImageId
  }
  return body
}

function interpretShipEngineLabelPurchaseResponse(
  res: Response,
  data: unknown,
):
  | { ok: true; result: PurchasedShipEngineLabelResult }
  | { ok: false; error: string; status: number } {
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return {
      ok: false,
      error: apiErr,
      status: res.ok ? 422 : res.status >= 400 ? res.status : 502,
    }
  }

  const label = asRecord(data)
  if (!res.ok || !label) {
    const fallback =
      typeof data === "object" && data
        ? JSON.stringify(data).slice(0, 800)
        : "Could not purchase label"
    return {
      ok: false,
      error: fallback,
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const status = typeof label.status === "string" ? label.status.toLowerCase() : ""
  if (status === "error") {
    return {
      ok: false,
      error: formatShipEngineApiError(data) || JSON.stringify(data).slice(0, 800),
      status: 422,
    }
  }

  if (status === "processing") {
    return {
      ok: false,
      error:
        "The carrier is still creating this label. Wait a few seconds and click Buy label again (or request a fresh checkout-lane quote if it keeps failing).",
      status: 409,
    }
  }

  const trackingNumber = extractTrackingNumberFromLabel(label)
  if (!trackingNumber) {
    const hasLabel =
      Boolean(label.label_id) ||
      Boolean(pickLabelPdfUrl(label)) ||
      status === "completed" ||
      status === "label_printed"
    if (hasLabel) {
      return {
        ok: false,
        error:
          "The carrier returned a label without a tracking number. Add tracking manually on the sale or contact support.",
        status: 502,
      }
    }
    return {
      ok: false,
      error: "Label response did not include tracking. Try a fresh rate quote — old quotes expire after a few minutes.",
      status: 502,
    }
  }

  const cost = pickLabelCost(label)

  return {
    ok: true,
    result: {
      labelUrl: pickLabelPdfUrl(label),
      trackingNumber,
      trackingCarrier: pickTrackingCarrierLabel(label),
      costAmount: cost.amount,
      costCurrency: cost.currency,
    },
  }
}

export async function purchaseShipEngineLabel(rateId: string): Promise<
  | { ok: true; result: PurchasedShipEngineLabelResult }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "Label printing is not configured.", status: 503 }
  }

  const trimmed = rateId.trim()
  const labelImageId = getShipEngineLabelImageId()
  let includeLabelImage = Boolean(labelImageId)

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await shipEngineRequest(`/labels/rates/${encodeURIComponent(trimmed)}`, {
      method: "POST",
      body: JSON.stringify(buildShipEngineLabelPurchaseBody(includeLabelImage)),
    })
    const data = await parseJsonSafe(res)

    if (includeLabelImage && isLabelImagesNotSupportedError(data)) {
      console.warn(
        `[purchaseShipEngineLabel] Carrier does not support label_image_id for rate ${trimmed}; retrying without branding.`,
      )
      includeLabelImage = false
      continue
    }

    return interpretShipEngineLabelPurchaseResponse(res, data)
  }

  return {
    ok: false,
    error: "Could not purchase label without branded image.",
    status: 502,
  }
}
