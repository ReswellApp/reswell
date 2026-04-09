import { requireAdmin } from "@/lib/brands/admin-server"
import { shippoRequest } from "@/lib/shippo/client"
import { isShippoConfigured } from "@/lib/shippo/config"
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
 * GET: carrier accounts, recent shipments, recent label transactions.
 * POST: validate_address | rates | create_transaction (purchase label).
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (!isShippoConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "Add SHIPPO_API_KEY to the server environment.",
    })
  }

  const [carrierAccounts, shipments, transactions] = await Promise.all([
    apiSlice(await shippoRequest("/carrier_accounts?results=100")),
    apiSlice(await shippoRequest("/shipments?results=25")),
    apiSlice(await shippoRequest("/transactions?results=25")),
  ])

  return NextResponse.json({
    configured: true,
    carrierAccounts,
    shipments,
    transactions,
  })
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (!isShippoConfigured()) {
    return NextResponse.json(
      { error: "SHIPPO_API_KEY is not configured" },
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
        if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
          return NextResponse.json(
            {
              error:
                "payload must be a Shippo address object (see POST /addresses)",
            },
            { status: 400 },
          )
        }
        const addr = { ...(payload as Record<string, unknown>), validate: true }
        const res = await shippoRequest("/addresses", {
          method: "POST",
          body: JSON.stringify(addr),
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
                "payload must be a JSON object (Shippo POST /shipments body). async:false is applied if omitted.",
            },
            { status: 400 },
          )
        }
        const p = { ...(obj.payload as Record<string, unknown>) }
        if (p.async === undefined) p.async = false
        const res = await shippoRequest("/shipments", {
          method: "POST",
          body: JSON.stringify(p),
        })
        const data = await parseJsonSafe(res)
        return NextResponse.json(
          { ok: res.ok, status: res.status, data },
          { status: res.ok ? 200 : res.status },
        )
      }
      case "create_label":
      case "purchase_rate":
      case "create_transaction": {
        if (obj.payload == null || typeof obj.payload !== "object") {
          return NextResponse.json(
            {
              error:
                "payload must be a JSON object (Shippo POST /transactions body; include rate object_id)",
            },
            { status: 400 },
          )
        }
        const res = await shippoRequest("/transactions", {
          method: "POST",
          body: JSON.stringify(obj.payload),
        })
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
              "Unknown action (use validate_address | rates | create_transaction | create_label | purchase_rate)",
          },
          { status: 400 },
        )
    }
  } catch (e) {
    console.error("admin shippo POST:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Shippo request failed" },
      { status: 500 },
    )
  }
}
