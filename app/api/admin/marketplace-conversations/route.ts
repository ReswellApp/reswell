import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminMarketplaceConversations } from "@/lib/services/adminMarketplaceMessages"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  q: z.string().optional(),
})

/**
 * GET /api/admin/marketplace-conversations
 *
 * Paginated buyer↔seller threads (one row per conversation) for the admin inbox.
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

  const { limit, offset, q } = parsed.data

  const { rows, count, error } = await getAdminMarketplaceConversations({
    limit,
    offset,
    search: q?.trim() || undefined,
  })

  if (error) {
    console.error("[admin marketplace-conversations]", error)
    return NextResponse.json({ error: "Could not load conversations" }, { status: 500 })
  }

  return NextResponse.json({ data: rows, total: count ?? 0 })
}
