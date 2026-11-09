import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { readOptionalMobileSession } from "@/lib/auth/mobile-session"
import { authorizeSupportCaseMessageAttachmentDownload } from "@/lib/services/supportCaseMessageAttachmentAccess"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

function contentDispositionHeader(fileName: string, inline: boolean): string {
  const fallback = "attachment"
  const safe = fileName.replace(/["\r\n\\]/g, "_").trim().slice(0, 200) || fallback
  const star = encodeURIComponent(safe)
  const mode = inline ? "inline" : "attachment"
  return `${mode}; filename="${safe}"; filename*=UTF-8''${star}`
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await context.params
  const parsed = z.string().uuid().safeParse(messageId)
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 })
  }

  const mobile = await readOptionalMobileSession(request)
  const supabase = mobile?.ok ? mobile.supabase : await createClient()
  const auth = await authorizeSupportCaseMessageAttachmentDownload(parsed.data, supabase)
  if (!auth.ok) {
    return new NextResponse(null, { status: auth.status })
  }

  return new NextResponse(null, { status: 200 })
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

  const mobile = await readOptionalMobileSession(request)
  const supabase = mobile?.ok ? mobile.supabase : await createClient()
  const auth = await authorizeSupportCaseMessageAttachmentDownload(parsed.data, supabase)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const sr = createServiceRoleClient()
  const { data: blob, error: dlErr } = await sr.storage.from(auth.bucket).download(auth.path)

  if (dlErr || !blob) {
    console.error("[support message attachment GET] download:", dlErr)
    return NextResponse.json({ error: "Could not load file" }, { status: 500 })
  }

  const buf = await blob.arrayBuffer()
  const forceDownload = request.nextUrl.searchParams.get("download") === "1"
  const inline = !forceDownload

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": auth.mimeType,
      "Content-Disposition": contentDispositionHeader(auth.fileName, inline),
      "Cache-Control": "private, no-store",
    },
  })
}
