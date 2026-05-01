import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { formatShipEngineApiError } from "@/lib/shipengine/errors"

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

export type ShipEngineVoidLabelResult = {
  approved: boolean
  message: string
}

/**
 * PUT /v1/labels/:label_id/void — carrier-dependent refund to ShipEngine/ShipStation balance.
 * @see https://www.shipengine.com/docs/labels/voiding/
 */
export async function voidShipEngineLabel(labelId: string): Promise<
  | { ok: true; result: ShipEngineVoidLabelResult }
  | { ok: false; error: string; status: number }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "SHIPENGINE_API_KEY is not configured.", status: 503 }
  }

  const id = labelId.trim()
  if (!id || !/^se-[a-zA-Z0-9_-]+$/.test(id)) {
    return { ok: false, error: "Invalid label_id (expected format like se-123…).", status: 400 }
  }

  const res = await shipEngineRequest(`/labels/${encodeURIComponent(id)}/void`, {
    method: "PUT",
    body: "{}",
  })
  const data = await parseJsonSafe(res)
  const apiErr = formatShipEngineApiError(data)
  if (apiErr) {
    return { ok: false, error: apiErr, status: res.ok ? 422 : res.status >= 400 ? res.status : 502 }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data === "string" ? data : JSON.stringify(data).slice(0, 400),
      status: res.status >= 400 ? res.status : 502,
    }
  }

  const row = asRecord(data)
  const approved = row?.approved === true
  const message =
    typeof row?.message === "string" && row.message.trim().length > 0
      ? row.message.trim()
      : approved
        ? "Label voided."
        : "Void request was not approved."

  return { ok: true, result: { approved, message } }
}
