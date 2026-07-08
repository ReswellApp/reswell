import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSafeRouteUser } from "@/lib/auth/get-safe-server-user"
import { fetchOwnedListingForEdit } from "@/lib/db/listingEdit"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  response.headers.set("Cache-Control", "private, no-store")

  const { supabase, user } = await getSafeRouteUser(request, response)
  if (!user) {
    return response
  }

  try {
    const { id: rawId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    const listing = await fetchOwnedListingForEdit(supabase, idParsed.data, user.id)
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    const ok = NextResponse.json(
      {
        data: {
          userId: user.id,
          listing,
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
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
