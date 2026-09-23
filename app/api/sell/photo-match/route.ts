import { NextResponse } from "next/server"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { isSellPhotoMatchEnabled, matchSellPhoto } from "@/lib/services/sellPhotoMatch"
import {
  SELL_PHOTO_MATCH_MAX_BYTES,
  sniffSellPhotoMatchMime,
} from "@/lib/sell-flow/sell-photo-match"
import { getDb } from "@/lib/supabase/db"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/sell/photo-match
 * Admin-only. A photo of a surfboard or fin is read by the vision model, then
 * matched through the existing /sell catalog search.
 */
export async function POST(req: Request) {
  let userId: string | null = null
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 })
    }
    userId = user.id

    const isAdmin = await fetchProfileIsAdmin(supabaseAuth, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: "Not available." }, { status: 403 })
    }

    if (!isSellPhotoMatchEnabled()) {
      return NextResponse.json({ error: "Photo matching is not configured." }, { status: 503 })
    }

    const form = await req.formData()
    const photo = form.get("photo")
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "Choose a photo to scan." }, { status: 400 })
    }
    if (photo.size < 1 || photo.size > SELL_PHOTO_MATCH_MAX_BYTES) {
      return NextResponse.json(
        { error: "That photo is too large. Try a closer crop." },
        { status: 400 },
      )
    }

    const bytes = new Uint8Array(await photo.arrayBuffer())
    const mediaType = sniffSellPhotoMatchMime(bytes)
    if (!mediaType) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo." }, { status: 400 })
    }

    const supabase = getDb({ consistency: "eventual" })
    const result = await matchSellPhoto({ supabase, bytes, mediaType })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (error) {
    console.error("[api/sell/photo-match]", {
      at: new Date().toISOString(),
      userId,
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(
      { error: "Could not scan that photo. Please try again." },
      { status: 500 },
    )
  }
}
