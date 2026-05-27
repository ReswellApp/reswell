import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeBoardReviewAttachmentDownload } from "@/lib/services/boardReviewAttachmentAccess"
import { createServiceRoleClient } from "@/lib/supabase/server"

function contentDispositionHeader(fileName: string): string {
  const fallback = "photo"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  return `inline; filename="${safe}"; filename*=UTF-8''${star}`
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await context.params
  const parsed = z.string().uuid().safeParse(reviewId)
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 })
  }

  const auth = await authorizeBoardReviewAttachmentDownload(parsed.data)
  if (!auth.ok) {
    return new NextResponse(null, { status: auth.status })
  }

  return new NextResponse(null, { status: 200 })
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await context.params
  const parsed = z.string().uuid().safeParse(reviewId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 })
  }

  const auth = await authorizeBoardReviewAttachmentDownload(parsed.data)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const sr = createServiceRoleClient()
  const { data: blob, error: dlErr } = await sr.storage.from(auth.bucket).download(auth.path)

  if (dlErr || !blob) {
    console.error("[board review attachment GET] download:", dlErr)
    return NextResponse.json({ error: "Could not load file" }, { status: 500 })
  }

  const buf = await blob.arrayBuffer()

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": auth.mimeType,
      "Content-Disposition": contentDispositionHeader(auth.fileName),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
