import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { removeAdminMarketplaceMessage } from "@/lib/services/adminMarketplaceMessages"

/**
 * DELETE /api/admin/marketplace-messages/[id]
 *
 * Removes a buyer↔seller thread message for all participants (hard delete). Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const { id } = await context.params
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message id" }, { status: 400 })
  }

  const result = await removeAdminMarketplaceMessage(parsed.data)

  if (!result.ok) {
    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }
    console.error("[admin marketplace-messages delete]", result.error.message)
    return NextResponse.json({ error: "Could not delete message" }, { status: 500 })
  }

  return NextResponse.json({ success: true as const })
}
