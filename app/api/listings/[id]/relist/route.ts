import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { relistSellerMarkedSoldListing } from "@/lib/services/listingRelist"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id: rawId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    const result = await relistSellerMarkedSoldListing(supabase, {
      listingId: idParsed.data,
      sellerUserId: user.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
