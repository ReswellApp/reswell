import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteSellerDraftListing } from "@/lib/services/listingEnd"

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
