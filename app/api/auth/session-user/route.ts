import { getSafeRouteUser } from "@/lib/auth/get-safe-server-user"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Lightweight probe: returns the signed-in user from request cookies when the
 * browser Supabase client cannot read httpOnly SSR auth cookies yet.
 */
export async function GET(request: NextRequest) {
  const response = new NextResponse(null, { status: 401 })
  response.headers.set("Cache-Control", "private, no-store")

  const { user } = await getSafeRouteUser(request, response)

  if (!user) {
    return response
  }

  const ok = NextResponse.json(
    {
      data: {
        id: user.id,
        email: user.email ?? null,
      },
    },
    { status: 200 },
  )
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
