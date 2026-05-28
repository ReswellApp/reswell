import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { formatShipEngineApiError } from "@/lib/shipengine/errors"
import { fetchLabelsByTrackingNumber } from "@/lib/shipengine/label-lookup"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

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

export type ShipEngineTrackingPayload = {
  tracking_number?: string
  status_code?: string
  status_description?: string
  carrier_status_description?: string | null
  estimated_delivery_date?: string | null
  actual_delivery_date?: string | null
  exception_description?: string | null
  events?: Array<{
    occurred_at?: string
    description?: string | null
    city_locality?: string | null
    state_province?: string | null
    postal_code?: string | null
    country_code?: string | null
  }>
}

function normalizeTrackingPayload(data: unknown): ShipEngineTrackingPayload | null {
  const row = asRecord(data)
  if (!row) return null
  return row as ShipEngineTrackingPayload
}

/** GET /v1/tracking?carrier_code=…&tracking_number=… */
export async function fetchShipEngineTrackingByCarrier(params: {
  carrierCode: string
  trackingNumber: string
}): Promise<
  | { ok: true; payload: ShipEngineTrackingPayload }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured.", status: 503 }
  }

  const carrierCode = params.carrierCode.trim()
  const trackingNumber = params.trackingNumber.trim()
  if (!carrierCode || !trackingNumber) {
    return { ok: false, error: "Carrier code and tracking number are required.", status: 400 }
  }

  const q = new URLSearchParams({
    carrier_code: carrierCode,
    tracking_number: trackingNumber,
  })
  const res = await shipEngineRequest(`/tracking?${q.toString()}`)
  const data = await parseJsonSafe(res)
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return { ok: false, error: apiErr, status: res.ok ? 422 : res.status >= 400 ? res.status : 502 }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data === "string" ? data : "Could not fetch carrier tracking.",
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const payload = normalizeTrackingPayload(data)
  if (!payload) {
    return { ok: false, error: "Unexpected ShipEngine tracking response.", status: 502 }
  }
  return { ok: true, payload }
}

/** GET /v1/labels/{label_id}/track — preferred for Reswell-purchased labels. */
export async function fetchShipEngineTrackingByLabelId(labelId: string): Promise<
  | { ok: true; payload: ShipEngineTrackingPayload }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured.", status: 503 }
  }

  const id = labelId.trim()
  if (!id || !/^se-[a-zA-Z0-9_-]+$/.test(id)) {
    return { ok: false, error: "Invalid label id.", status: 400 }
  }

  const res = await shipEngineRequest(`/labels/${encodeURIComponent(id)}/track`)
  const data = await parseJsonSafe(res)
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return { ok: false, error: apiErr, status: res.ok ? 422 : res.status >= 400 ? res.status : 502 }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data === "string" ? data : "Could not fetch label tracking.",
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const payload = normalizeTrackingPayload(data)
  if (!payload) {
    return { ok: false, error: "Unexpected ShipEngine label tracking response.", status: 502 }
  }
  return { ok: true, payload }
}

/**
 * Best-effort live tracking. When `carrierCode` is known, hits carrier tracking first (fast).
 * Otherwise tries Reswell label lookup, then carrier_code + tracking_number.
 */
export async function fetchLiveShipEngineTracking(params: {
  trackingNumber: string
  carrierCode?: string | null
}): Promise<
  | { ok: true; payload: ShipEngineTrackingPayload; source: "label" | "carrier" }
  | { ok: false; error: string; status: number }
> {
  const trackingNumber = normalizeTrackingNumberForCarrier(params.trackingNumber)
  if (!trackingNumber) {
    return { ok: false, error: "Missing tracking number.", status: 400 }
  }

  const carrierCode = params.carrierCode?.trim() || null

  let carrierAttempt:
    | { ok: true; payload: ShipEngineTrackingPayload }
    | { ok: false; error: string; status: number }
    | null = null

  if (carrierCode) {
    carrierAttempt = await fetchShipEngineTrackingByCarrier({
      carrierCode,
      trackingNumber,
    })
    if (carrierAttempt.ok) {
      return { ok: true, payload: carrierAttempt.payload, source: "carrier" }
    }
  }

  const labels = await fetchLabelsByTrackingNumber(trackingNumber)
  if (labels.ok && labels.labels.length > 0) {
    const labelId = labels.labels[0]?.label_id
    if (labelId) {
      const byLabel = await fetchShipEngineTrackingByLabelId(labelId)
      if (byLabel.ok) {
        return { ok: true, payload: byLabel.payload, source: "label" }
      }
    }
  }

  if (carrierAttempt && !carrierAttempt.ok) {
    return carrierAttempt
  }

  if (!carrierCode) {
    return {
      ok: false,
      error: "Could not resolve carrier for tracking lookup.",
      status: 422,
    }
  }

  return {
    ok: false,
    error: "Could not load carrier tracking.",
    status: 502,
  }
}
