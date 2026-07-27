import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  extractListingFromPhotos,
  isAllowedListingPhotoExtractUrl,
} from "@/lib/services/extractListingFromPhotos"
import {
  EXTRACT_LISTING_FROM_PHOTOS_RATE_LIMIT_MESSAGE,
  checkExtractListingFromPhotosRateLimit,
} from "@/lib/utils/scan-board-dims-rate-limit"
import { extractListingFromPhotosRequestSchema } from "@/lib/validations/extract-listing-from-photos"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to analyze listing photos." },
      { status: 401 },
    )
  }

  const rate = checkExtractListingFromPhotosRateLimit(user.id)
  if (!rate.ok) {
    return NextResponse.json(
      { error: EXTRACT_LISTING_FROM_PHOTOS_RATE_LIMIT_MESSAGE },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = extractListingFromPhotosRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid photo URLs." }, { status: 400 })
  }

  const imageUrls = parsed.data.imageUrls.filter(isAllowedListingPhotoExtractUrl)
  if (imageUrls.length === 0) {
    return NextResponse.json(
      { error: "No valid listing photo URLs." },
      { status: 400 },
    )
  }

  const result = await extractListingFromPhotos({ imageUrls, supabase })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
