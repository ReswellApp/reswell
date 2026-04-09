import { requireAdmin } from "@/lib/brands/admin-server"
import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function parseJsonSafe(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return t
  }
}

async function apiSlice(res: Response) {
  const data = await parseJsonSafe(res)
  return { ok: res.ok, status: res.status, data }
}

/**
 * GET: carriers, warehouses, recent labels (read-only overview).
 * POST: proxy to ShipEngine for validate_address | rates | create_label | purchase_rate.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (!isShipEngineConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "Add SHIPENGINE_API_KEY to the server environment.",
    })
  }

  const [carriers, warehouses, labels] = await Promise.all([
    apiSlice(await shipEngineRequest("/carriers")),
    apiSlice(await shipEngineRequest("/warehouses")),
    apiSlice(
      await shipEngineRequest(
        "/labels?page_size=25&sort_dir=desc&sort_by=created_at",
      ),
    ),
  ])

  return NextResponse.json({
    configured: true,
    carriers,
    warehouses,
    labels,
  })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (!isShipEngineConfigured()) {
    return NextResponse.json(
      { error: "SHIPENGINE_API_KEY is not configured" },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const obj = body as { action?: string; payload?: unknown }
  const action = obj.action
  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 })
  }

  try {
    switch (action) {
      case "validate_address": {
        const payload = obj.payload
        const addresses = Array.isArray(payload)
          ? payload
          : payload != null && typeof payload === "object"
            ? [payload]
            : null
        if (!addresses?.length) {
          return NextResponse.json(
            {
              error:
                "payload must be an address object or array of addresses (see ShipEngine validate address)",
            },
            { status: 400 },
          )
        }
        const res = await shipEngineRequest("/addresses/validate", {
          method: "POST",
          body: JSON.stringify(addresses),
        })
        const data = await parseJsonSafe(res)
        return NextResponse.json(
          { ok: res.ok, status: res.status, data },
          { status: res.ok ? 200 : res.status },
        )
      }
      case "rates": {
        if (obj.payload == null || typeof obj.payload !== "object") {
          return NextResponse.json(
            {
              error:
                "payload must be a JSON object (ShipEngine POST /v1/rates body)",
            },
            { status: 400 },
          )
        }
        const res = await shipEngineRequest("/rates", {
          method: "POST",
          body: JSON.stringify(obj.payload),
        })
        const data = await parseJsonSafe(res)
        return NextResponse.json(
          { ok: res.ok, status: res.status, data },
          { status: res.ok ? 200 : res.status },
        )
      }
      case "create_label": {
        if (obj.payload == null || typeof obj.payload !== "object") {
          return NextResponse.json(
            {
              error:
                "payload must be a JSON object (ShipEngine POST /v1/labels body)",
            },
            { status: 400 },
          )
        }
        const res = await shipEngineRequest("/labels", {
          method: "POST",
          body: JSON.stringify(obj.payload),
        })
        const data = await parseJsonSafe(res)
        return NextResponse.json(
          { ok: res.ok, status: res.status, data },
          { status: res.ok ? 200 : res.status },
        )
      }
      case "purchase_rate": {
        const p = obj.payload as Record<string, unknown> | null
        const rateId =
          p && typeof p.rate_id === "string" ? p.rate_id.trim() : ""
        if (!rateId) {
          return NextResponse.json(
            { error: "payload.rate_id is required" },
            { status: 400 },
          )
        }
        const { rate_id: _drop, ...rest } = p
        const res = await shipEngineRequest(
          `/labels/rates/${encodeURIComponent(rateId)}`,
          {
            method: "POST",
            body: JSON.stringify(rest),
          },
        )
        const data = await parseJsonSafe(res)
        return NextResponse.json(
          { ok: res.ok, status: res.status, data },
          { status: res.ok ? 200 : res.status },
        )
      }
      default:
        return NextResponse.json(
          {
            error:
              "Unknown action (use validate_address | rates | create_label | purchase_rate)",
          },
          { status: 400 },
        )
    }
  } catch (e) {
    console.error("admin shipengine POST:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ShipEngine request failed" },
      { status: 500 },
    )
  }
}
