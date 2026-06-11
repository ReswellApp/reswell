import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authorizeMarketplaceAttachmentDownload } from "@/lib/services/marketplaceMessageAttachmentAccess"
import { createServiceRoleClient } from "@/lib/supabase/server"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "attachment"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

/**
 * GET/HEAD /api/messages/[messageId]/attachment
 *
 * Streams the attachment from storage through reswell.app (no Supabase URLs in the browser).
 */
export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params
  const parsed = z.string().uuid().safeParse(messageId)
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 })
  }

  const auth = await authorizeMarketplaceAttachmentDownload(parsed.data)
  if (!auth.ok) {
    return new NextResponse(null, { status: auth.status })
  }

  return new NextResponse(null, { status: 200 })
}

/**
 * Streams large video attachments from storage with HTTP Range support so the
 * browser can seek and progressively play without buffering the whole file
 * in function memory.
 */
async function streamVideoFromStorage(
  request: NextRequest,
  auth: { bucket: string; path: string; mimeType: string; fileName: string },
): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Could not load file" }, { status: 500 })
  }

  const range = request.headers.get("range")
  const upstream = await fetch(
    `${supabaseUrl}/storage/v1/object/${auth.bucket}/${auth.path}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        ...(range ? { Range: range } : {}),
      },
    },
  )

  if (!upstream.ok && upstream.status !== 206) {
    console.error("[message attachment GET] video stream:", upstream.status)
    return NextResponse.json({ error: "Could not load file" }, { status: 500 })
  }

  const headers = new Headers({
    "Content-Type": auth.mimeType,
    "Content-Disposition": contentDispositionHeader(auth.fileName, true),
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  })
  const contentLength = upstream.headers.get("content-length")
  if (contentLength) headers.set("Content-Length", contentLength)
  const contentRange = upstream.headers.get("content-range")
  if (contentRange) headers.set("Content-Range", contentRange)

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params
  const parsed = z.string().uuid().safeParse(messageId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 })
  }

  const auth = await authorizeMarketplaceAttachmentDownload(parsed.data)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (auth.attachmentKind === "video") {
    return streamVideoFromStorage(request, auth)
  }

  const sr = createServiceRoleClient()
  const { data: blob, error: dlErr } = await sr.storage.from(auth.bucket).download(auth.path)

  if (dlErr || !blob) {
    console.error("[message attachment GET] download:", dlErr)
    return NextResponse.json({ error: "Could not load file" }, { status: 500 })
  }

  const buf = await blob.arrayBuffer()
  const inline = auth.attachmentKind === "image"

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": auth.mimeType,
      "Content-Disposition": contentDispositionHeader(auth.fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
