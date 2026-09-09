import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { applyPublishedListingSideEffects } from "@/lib/services/publishListingDraft"

const listingIdSchema = z.string().uuid()

/**
 * Post-publish search / merchant / notify work. Route handler so /sell does
 * not refresh RSC mid-save.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const parsed = listingIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }
  const listingId = parsed.data

  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, user_id, status")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }
  if (listing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (listing.status !== "active") {
    return NextResponse.json({ error: "Only live listings can be synced." }, { status: 400 })
  }

  try {
    await applyPublishedListingSideEffects(supabase, listingId, user.id)
    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch (error) {
    console.error(
      "POST /api/listings/[id]/publish-side-effects:",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json({ error: "Could not sync the published listing." }, { status: 500 })
  }
}
