import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { adminSendMarketplacePdfMessage } from "@/lib/services/adminSendMarketplacePdfMessage"

/**
 * POST /api/admin/conversations/[id]/messages/pdf
 *
 * Multipart: `file` (PDF), optional `caption` (text field).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const { id: conversationId } = await context.params
  const idParse = z.string().uuid().safeParse(conversationId)
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 })
  }

  const captionRaw = form.get("caption")
  const caption =
    typeof captionRaw === "string" ? captionRaw : captionRaw != null ? String(captionRaw) : null

  const buf = new Uint8Array(await file.arrayBuffer())
  const result = await adminSendMarketplacePdfMessage({
    conversationId: idParse.data,
    staffUserId: gate.ctx.user.id,
    pdfBytes: buf,
    clientFileName: file.name || "document.pdf",
    caption,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.message }, { status: 201 })
}
