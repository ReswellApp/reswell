import { NextResponse, type NextRequest } from "next/server"
import { attachDeviceCookie } from "@/lib/messages/access-signals"

export const dynamic = "force-dynamic"

/**
 * Sets `rw_did` off the document response so marketplace HTML can stay in the
 * CDN cache. The proxy also attaches the cookie here; this handler makes the
 * contract explicit for the client beacon.
 */
export async function POST(request: NextRequest) {
  const response = new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  })
  return attachDeviceCookie(request, response)
}
