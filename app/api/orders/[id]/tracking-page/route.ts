import { NextResponse } from "next/server"
import { getPublicOrderTrackingPage } from "@/lib/services/publicOrderTracking"

export const dynamic = "force-dynamic"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const orderId = id?.trim() ?? ""
    if (!ORDER_ID_RE.test(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 })
    }

    const page = await getPublicOrderTrackingPage(orderId)
    if (!page) {
      return NextResponse.json({ error: "Tracking is not available" }, { status: 404 })
    }

    const terminal = page.deliveryStatus === "delivered" || page.deliveryStatus === "picked_up"
    return NextResponse.json(
      {
        data: page.detail,
        live: !terminal,
        fetchError: page.detail ? null : "Carrier scans have not posted yet.",
        marketplace: {
          delivery_status: page.deliveryStatus,
          carrier_delivered_at: page.detail?.actual_delivery_date ?? null,
        },
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[tracking-page]", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load tracking right now" }, { status: 500 })
  }
}
