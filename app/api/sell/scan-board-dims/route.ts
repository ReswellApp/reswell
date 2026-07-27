import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scanBoardDimensionsFromImage } from "@/lib/services/scanBoardDimensions"
import {
  SCAN_BOARD_DIMS_RATE_LIMIT_MESSAGE,
  checkScanBoardDimsRateLimit,
} from "@/lib/utils/scan-board-dims-rate-limit"
import { scanBoardDimsRequestSchema } from "@/lib/validations/scan-board-dims"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to scan a board sticker." },
      { status: 401 },
    )
  }

  const rate = checkScanBoardDimsRateLimit(user.id)
  if (!rate.ok) {
    return NextResponse.json(
      { error: SCAN_BOARD_DIMS_RATE_LIMIT_MESSAGE },
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

  const parsed = scanBoardDimsRequestSchema.safeParse(body)
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.imageBase64?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      "Invalid image payload"
    return NextResponse.json({ error: first }, { status: 400 })
  }

  // Strip data-URL prefix if the client sent one by mistake
  let imageBase64 = parsed.data.imageBase64.trim()
  const dataUrl = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(imageBase64)
  let mediaType = parsed.data.mediaType
  if (dataUrl) {
    mediaType = dataUrl[1].toLowerCase() as typeof mediaType
    imageBase64 = dataUrl[2]
  }
  imageBase64 = imageBase64.replace(/\s/g, "")

  const result = await scanBoardDimensionsFromImage({
    imageBase64,
    mediaType,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
