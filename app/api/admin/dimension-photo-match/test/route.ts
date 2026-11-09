import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { sniffSellPhotoMatchMime } from "@/lib/sell-flow/sell-photo-match"
import {
  isSurfboardDimensionPhotoMatchEnabled,
  matchSurfboardDimensionPhotos,
} from "@/lib/services/surfboardDimensionPhotoMatch"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

/** Soft cap per request — UI sends one file at a time for bulk uploads. */
const MAX_SHOTS = 24
/** Under Vercel’s ~4.5MB body limit; prefer full stamp photos over tiny thumbs. */
const MAX_BYTES_PER_PHOTO = 4_000_000
const MAX_TOTAL_BYTES = MAX_BYTES_PER_PHOTO

/**
 * POST /api/admin/dimension-photo-match/test
 * Admin playground: upload surfboard photos, run vision match against the
 * labeled reference corpus, and persist a reviewable match row.
 * Uploaded bytes are stored in the Supabase `listings` bucket under
 * `dimension-photo-matches/{uuid}/`.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return NextResponse.json(
      { error: "Dimension photo matching is not configured." },
      { status: 503 },
    )
  }

  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    )
  }

  try {
    const form = await req.formData()
    const files = form
      .getAll("photos")
      .filter((item): item is File => item instanceof File && item.size > 0)
      .slice(0, MAX_SHOTS)

    if (files.length < 1) {
      return NextResponse.json({ error: "Add at least one surfboard photo." }, { status: 400 })
    }

    let totalBytes = 0
    const shots = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      if (file.size > MAX_BYTES_PER_PHOTO) {
        return NextResponse.json(
          { error: "One of those photos is too large (max ~4MB)." },
          { status: 400 },
        )
      }
      totalBytes += file.size
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Those photos are too large together." },
          { status: 400 },
        )
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const mediaType = sniffSellPhotoMatchMime(bytes)
      if (!mediaType) {
        return NextResponse.json({ error: "Use JPEG, PNG, or WebP photos." }, { status: 400 })
      }
      shots.push({
        shot: files.length === 1 ? "board" : `shot_${i + 1}`,
        bytes,
        mediaType,
      })
    }

    const result = await matchSurfboardDimensionPhotos({
      supabase: service,
      surface: "admin_test",
      shots,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      data: {
        match: result.match,
        observation: result.observation,
        references: result.references,
      },
    })
  } catch (error) {
    console.error("[api/admin/dimension-photo-match/test]", {
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(
      { error: "Could not run dimension photo match." },
      { status: 500 },
    )
  }
}
