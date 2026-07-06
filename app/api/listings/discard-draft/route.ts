import { NextRequest, NextResponse } from "next/server"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { deleteSellerDraftListing } from "@/lib/services/listingEnd"

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const result = await deleteSellerDraftListing(supabase, {
      listingId: id,
      sellerUserId: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 })
  }
}
