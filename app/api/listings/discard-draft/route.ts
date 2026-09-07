import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { deleteSellerDraftListing } from "@/lib/services/listingEnd"
import { deleteGuestDraftListing } from "@/lib/db/listingGuestDrafts"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  SELL_GUEST_DRAFT_COOKIE,
  hashGuestDraftToken,
} from "@/lib/sell-flow/guest-draft-token"

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    if (user) {
      const result = await deleteSellerDraftListing(supabase, {
        listingId: id,
        sellerUserId: user.id,
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
      }

      return NextResponse.json({ data: { ok: true } }, { status: 200 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get(SELL_GUEST_DRAFT_COOKIE)?.value?.trim()
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const service = createServiceRoleClient()
    const result = await deleteGuestDraftListing(service, {
      listingId: id,
      tokenHash: hashGuestDraftToken(token),
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 })
  }
}
