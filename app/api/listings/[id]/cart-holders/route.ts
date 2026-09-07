import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { listListingCartHoldersForSeller } from "@/lib/services/listingCartHolders"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Sign in to view cart buyers." }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const idParsed = listingIdParamSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid listing id." }, { status: 400 })
  }

  const result = await listListingCartHoldersForSeller(supabase, user.id, idParsed.data)
  if (!result.ok) {
    const failed = NextResponse.json({ error: result.error }, { status: result.status })
    failed.headers.set("Cache-Control", "private, no-store")
    return failed
  }

  const response = NextResponse.json({ data: { holders: result.holders } }, { status: 200 })
  response.headers.set("Cache-Control", "private, no-store")
  return response
}
