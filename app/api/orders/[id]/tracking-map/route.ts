import { NextResponse } from "next/server"
import { googleStaticMapRouteUrl } from "@/lib/maps/google-static-map-url"
import { getPublicOrderTrackingPage } from "@/lib/services/publicOrderTracking"
import { trackingMapPointsFromEvents } from "@/lib/shipping/tracking-map-points"

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

    const mapUrl = googleStaticMapRouteUrl(trackingMapPointsFromEvents(page.detail?.events))
    if (!mapUrl) {
      return NextResponse.json({ error: "Map is not available" }, { status: 404 })
    }

    const res = await fetch(mapUrl, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ error: "Map is not available" }, { status: 502 })
    }

    const bytes = await res.arrayBuffer()
    const contentType = res.headers.get("content-type")?.trim() || "image/png"
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    console.error("[tracking-map]", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load tracking map" }, { status: 500 })
  }
}
