import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { adminSendMarketplaceThreadMessage } from "@/lib/services/adminSendMarketplaceThreadMessage"
import { adminMarketplaceThreadReplyBodySchema } from "@/lib/validations/adminMarketplaceThreadReply"

/**
 * POST /api/admin/conversations/[id]/messages
 *
 * Sends a text reply into a buyer↔seller thread as the logged-in staff user (service role insert).
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

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 })
  }

  const parsed = adminMarketplaceThreadReplyBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const result = await adminSendMarketplaceThreadMessage({
    conversationId: idParse.data,
    staffUserId: gate.ctx.user.id,
    content: parsed.data.content,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.message }, { status: 201 })
}
