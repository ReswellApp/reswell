import { NextResponse } from "next/server"
import { z } from "zod"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { matchActiveListingPhotos } from "@/lib/services/sellListingPhotoMatch"
import { isSellPhotoMatchEnabled } from "@/lib/services/sellPhotoMatch"
import { SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT } from "@/lib/sell-flow/sell-photo-match"
import { getDb } from "@/lib/supabase/db"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  listingId: z.string().uuid(),
  imageIds: z.array(z.string().uuid()).min(1).max(SELL_PHOTO_MATCH_LISTING_IMAGE_LIMIT),
})

/**
 * POST /api/sell/photo-match/listing
 * Admin-only. Reads the chosen photos from one active surfboard listing
 * and matches them to a catalog brand or model. The saved listing names are not sent to the model.
 */
export async function POST(req: Request) {
  let userId: string | null = null
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not available." }, { status: 404 })
    userId = user.id
    const isAdmin = await fetchProfileIsAdmin(supabaseAuth, user.id)
    if (!isAdmin) return NextResponse.json({ error: "Not available." }, { status: 404 })
    if (!isSellPhotoMatchEnabled()) {
      return NextResponse.json({ error: "Photo matching is not configured." }, { status: 503 })
    }

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose up to 6 photos from a live listing." }, { status: 400 })
    }

    const result = await matchActiveListingPhotos(getDb({ consistency: "eventual" }), parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data, listing: result.listing })
  } catch (error) {
    console.error("[api/sell/photo-match/listing]", {
      at: new Date().toISOString(),
      userId,
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(
      { error: "Could not match those listing photos. Please try again." },
      { status: 500 },
    )
  }
}
