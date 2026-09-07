import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSafeRouteUser } from "@/lib/auth/get-safe-server-user"
import { fetchListingForEditById, fetchOwnedListingForEdit } from "@/lib/db/listingEdit"
import {
  IMPERSONATION_COOKIE,
  impersonationCookieOptions,
  parseImpersonationCookie,
  serializeImpersonationCookie,
} from "@/lib/impersonation"
import { createServiceRoleClient } from "@/lib/supabase/server"

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

    const impersonationRaw = request.cookies.get(IMPERSONATION_COOKIE)?.value
    const impersonation = impersonationRaw
      ? parseImpersonationCookie(impersonationRaw)
      : null

    let listing = await fetchOwnedListingForEdit(supabase, idParsed.data, user.id)
    let impersonationCookieToSet: ReturnType<typeof serializeImpersonationCookie> | null = null
    let actorIsAdmin = false

    if (!listing) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle()

      actorIsAdmin = profile?.is_admin === true
      if (actorIsAdmin) {
        if (impersonation) {
          listing = await fetchOwnedListingForEdit(supabase, idParsed.data, impersonation.userId)
        }
        if (!listing) {
          try {
            listing = await fetchListingForEditById(createServiceRoleClient(), idParsed.data)
          } catch {
            listing = null
          }
        }
      }
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    const ownerUserId = listing.user_id
    if (
      actorIsAdmin &&
      ownerUserId &&
      ownerUserId !== user.id &&
      impersonation?.userId === ownerUserId
    ) {
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", ownerUserId)
        .maybeSingle()
      impersonationCookieToSet = serializeImpersonationCookie({
        userId: ownerUserId,
        displayName:
          typeof sellerProfile?.display_name === "string" && sellerProfile.display_name.trim()
            ? sellerProfile.display_name.trim()
            : impersonation.displayName || "User",
        email:
          typeof sellerProfile?.email === "string"
            ? sellerProfile.email
            : impersonation.email ?? null,
      })
    }

    const ok = NextResponse.json(
      {
        data: {
          userId: ownerUserId,
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
    if (impersonationCookieToSet) {
      ok.cookies.set(
        IMPERSONATION_COOKIE,
        impersonationCookieToSet,
        impersonationCookieOptions(),
      )
    }
    return ok
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
