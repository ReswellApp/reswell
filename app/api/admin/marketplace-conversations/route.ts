import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { getAdminMarketplaceConversations } from "@/lib/services/adminMarketplaceMessages"
import { startStaffOutboundMarketplaceConversation } from "@/lib/services/adminStartMarketplaceConversation"
import { adminStartMarketplaceConversationBodySchema } from "@/lib/validations/adminStartMarketplaceConversation"

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

/**
 * POST /api/admin/marketplace-conversations
 *
 * Opens or reuses a staff↔member marketplace thread and optionally sends an opening message.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 })
  }

  const parsed = adminStartMarketplaceConversationBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const result = await startStaffOutboundMarketplaceConversation({
    supabase: gate.ctx.supabase,
    staffUserId: gate.ctx.user.id,
    targetUserId: parsed.data.target_user_id,
    initialMessage: parsed.data.initial_message,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: {
      conversation_id: result.conversationId,
      created_new: result.createdNewConversation,
    },
  })
}
