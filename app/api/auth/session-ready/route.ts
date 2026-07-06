import { getSafeRouteUser } from "@/lib/auth/get-safe-server-user"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Lightweight probe: returns 204 when middleware/RSC would see a valid session.
 * Client-side sign-in can finish in the browser before HTTP auth cookies are visible
 * on the next document request — poll this before navigating to protected routes.
 */
export async function GET(request: NextRequest) {
  const response = new NextResponse(null, { status: 401 })
  response.headers.set("Cache-Control", "private, no-store")

  const { user } = await getSafeRouteUser(request, response)

  if (!user) {
    return response
  }

  const ok = new NextResponse(null, { status: 204 })
  ok.headers.set("Cache-Control", "private, no-store")
  response.cookies.getAll().forEach((cookie) => {
    ok.cookies.set({
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      domain: cookie.domain,
      expires: cookie.expires,
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      priority: cookie.priority,
      partitioned: cookie.partitioned,
    })
  })
  return ok
}
