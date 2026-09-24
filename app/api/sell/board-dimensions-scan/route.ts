import { NextResponse } from "next/server"
import {
  isSellBoardDimensionsScanEnabled,
  scanSellBoardDimensions,
} from "@/lib/services/sellBoardDimensionsScan"
import {
  SELL_PHOTO_MATCH_MAX_BYTES,
  sniffSellPhotoMatchMime,
} from "@/lib/sell-flow/sell-photo-match"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * POST /api/sell/board-dimensions-scan
 * Signed-in sellers. One photo of a surfboard size stamp is read into
 * length, width, thickness, and volume for the /sell/boards form.
 */
export async function POST(req: Request) {
  let userId: string | null = null
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Sign in to scan dimensions." }, { status: 401 })
    }
    userId = user.id

    if (!isSellBoardDimensionsScanEnabled()) {
      return NextResponse.json({ error: "Dimension scanning is not configured." }, { status: 503 })
    }

    const form = await req.formData()
    const photo = form.get("photo")
    if (!(photo instanceof File) || photo.size < 1) {
      return NextResponse.json(
        { error: "Take a photo of the dimensions stamp." },
        { status: 400 },
      )
    }
    if (photo.size > SELL_PHOTO_MATCH_MAX_BYTES) {
      return NextResponse.json(
        { error: "That photo is too large. Retake it a little farther back." },
        { status: 400 },
      )
    }

    const bytes = new Uint8Array(await photo.arrayBuffer())
    const mediaType = sniffSellPhotoMatchMime(bytes)
    if (!mediaType) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo." }, { status: 400 })
    }

    const result = await scanSellBoardDimensions({ photo: { bytes, mediaType } })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (error) {
    console.error("[api/sell/board-dimensions-scan]", {
      at: new Date().toISOString(),
      userId,
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(
      { error: "Could not read that photo. Please try again." },
      { status: 500 },
    )
  }
}
