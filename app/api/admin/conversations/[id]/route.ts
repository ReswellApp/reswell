import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminConversationHeader } from "@/lib/services/adminConversations"

/**
 * GET /api/admin/conversations/[id]
 *
 * Conversation header (buyer/seller/listing) for admin thread view.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const { id } = await context.params
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 })
  }

  const { data, error } = await getAdminConversationHeader(parsed.data)

  if (error) {
    console.error("[admin conversation]", error)
    return NextResponse.json({ error: "Could not load conversation" }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ data })
}
