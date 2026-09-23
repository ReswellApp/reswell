import { NextResponse } from "next/server"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { isSellPhotoMatchEnabled, matchSellPhoto } from "@/lib/services/sellPhotoMatch"
import {
  SELL_PHOTO_MATCH_MAX_BYTES,
  SELL_PHOTO_MATCH_MAX_TOTAL_BYTES,
  SELL_PHOTO_MATCH_SHOTS,
  missingSellPhotoMatchShots,
  sniffSellPhotoMatchMime,
  type SellPhotoMatchShot,
} from "@/lib/sell-flow/sell-photo-match"
import { getDb } from "@/lib/supabase/db"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

type ShotBytes = {
  bytes: Uint8Array
  mediaType: "image/jpeg" | "image/png" | "image/webp"
}

/**
 * POST /api/sell/photo-match
 * Admin-only. Three surfboard photos (top, bottom, dimensions close-up) are
 * read by the vision model, then matched to the surfboard catalog.
 * Non-admins receive 404. The /sell page does not render this UI for them.
 */
export async function POST(req: Request) {
  let userId: string | null = null
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Not available." }, { status: 404 })
    }
    userId = user.id

    const isAdmin = await fetchProfileIsAdmin(supabaseAuth, user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: "Not available." }, { status: 404 })
    }

    if (!isSellPhotoMatchEnabled()) {
      return NextResponse.json({ error: "Photo matching is not configured." }, { status: 503 })
    }

    const form = await req.formData()
    const present = SELL_PHOTO_MATCH_SHOTS.filter((shot) => form.get(shot) instanceof File)
    const missing = missingSellPhotoMatchShots(present)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Add the top, bottom, and dimensions photos." },
        { status: 400 },
      )
    }

    const shots = {} as Record<SellPhotoMatchShot, ShotBytes>
    let totalBytes = 0
    for (const shot of SELL_PHOTO_MATCH_SHOTS) {
      const photo = form.get(shot)
      if (!(photo instanceof File) || photo.size < 1 || photo.size > SELL_PHOTO_MATCH_MAX_BYTES) {
        return NextResponse.json(
          { error: "One of those photos is too large. Retake it a little farther back." },
          { status: 400 },
        )
      }
      totalBytes += photo.size
      if (totalBytes > SELL_PHOTO_MATCH_MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Those photos are too large together. Retake them a little farther back." },
          { status: 400 },
        )
      }
      const bytes = new Uint8Array(await photo.arrayBuffer())
      const mediaType = sniffSellPhotoMatchMime(bytes)
      if (!mediaType) {
        return NextResponse.json({ error: "Use JPEG, PNG, or WebP photos." }, { status: 400 })
      }
      shots[shot] = { bytes, mediaType }
    }

    const supabase = getDb({ consistency: "eventual" })
    const result = await matchSellPhoto({ supabase, shots })
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
      { error: "Could not scan those photos. Please try again." },
      { status: 500 },
    )
  }
}
