import { NextResponse } from "next/server"
import { orderPackageTrackPath } from "@/lib/utils/carrier-tracking-url"

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Legacy track links. Sends buyers to the on-site tracker, not a carrier site. */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const orderId = id?.trim() ?? ""
  if (!ORDER_ID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const path = orderPackageTrackPath(orderId)
  if (!path) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const response = NextResponse.redirect(new URL(path, request.url), 302)
  response.headers.set("Cache-Control", "no-store")
  return response
}
