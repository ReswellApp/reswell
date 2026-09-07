import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeMarketplaceReviewAttachmentDownload } from "@/lib/services/marketplaceReviewAttachments"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { MARKETPLACE_REVIEW_MAX_PHOTOS } from "@/lib/validations/marketplace-review-attachment"

function contentDispositionHeader(fileName: string): string {
  const fallback = "photo"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  return `inline; filename="${safe}"; filename*=UTF-8''${star}`
}

const indexSchema = z.coerce.number().int().min(0).max(MARKETPLACE_REVIEW_MAX_PHOTOS - 1)

async function authorizeParams(reviewIdRaw: string, indexRaw: string) {
  const reviewId = z.string().uuid().safeParse(reviewIdRaw)
  const index = indexSchema.safeParse(indexRaw)
  if (!reviewId.success || !index.success) {
    return { ok: false as const, status: 400, error: "Invalid photo request" }
  }
  const auth = await authorizeMarketplaceReviewAttachmentDownload(reviewId.data, index.data)
  if (!auth.ok) {
    return { ok: false as const, status: auth.status, error: auth.error }
  }
  return { ok: true as const, auth }
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ reviewId: string; index: string }> },
) {
  const { reviewId, index } = await context.params
  const result = await authorizeParams(reviewId, index)
  if (!result.ok) {
    return new NextResponse(null, { status: result.status })
  }
  return new NextResponse(null, { status: 200 })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reviewId: string; index: string }> },
) {
  const { reviewId, index } = await context.params
  const result = await authorizeParams(reviewId, index)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const sr = createServiceRoleClient()
  const { data: blob, error: dlErr } = await sr.storage.from(result.auth.bucket).download(result.auth.path)

  if (dlErr || !blob) {
    console.error("[marketplace review attachment GET] download:", dlErr)
    return NextResponse.json({ error: "Could not load file" }, { status: 500 })
  }

  const buf = await blob.arrayBuffer()

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": result.auth.mimeType,
      "Content-Disposition": contentDispositionHeader(result.auth.fileName),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
