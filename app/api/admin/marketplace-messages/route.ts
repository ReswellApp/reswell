import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminMarketplaceMessages } from "@/lib/services/adminMarketplaceMessages"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  conversation_id: z.string().uuid().optional(),
  q: z.string().optional(),
})

/**
 * GET /api/admin/marketplace-messages
 *
 * Paginated buyer↔seller thread messages for support. Uses service role after staff gate.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const { limit, offset, order, conversation_id, q } = parsed.data

  const { rows, count, error } = await getAdminMarketplaceMessages({
    limit,
    offset,
    order,
    conversationId: conversation_id,
    search: q?.trim() || undefined,
  })

  if (error) {
    console.error("[admin marketplace-messages]", error)
    return NextResponse.json({ error: "Could not load messages" }, { status: 500 })
  }

  return NextResponse.json({ data: rows, total: count ?? 0 })
}
