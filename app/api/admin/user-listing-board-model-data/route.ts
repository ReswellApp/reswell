import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listUserListingBoardModelDataForAdminPage } from "@/lib/db/user-listing-board-model-data"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  pending_only: z.enum(["true", "false"]).optional().default("true"),
})

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const sp = req.nextUrl.searchParams
  const parsed = querySchema.safeParse({
    limit: sp.get("limit") ?? undefined,
    offset: sp.get("offset") ?? undefined,
    pending_only: sp.get("pending_only") ?? undefined,
  })
  if (!parsed.success) {
    const err = parsed.error.flatten().formErrors.join(", ") || "Invalid query"
    return NextResponse.json({ error: err }, { status: 400 })
  }

  const result = await listUserListingBoardModelDataForAdminPage(gate.ctx.supabase, {
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    pendingOnly: parsed.data.pending_only === "true",
  })

  return NextResponse.json(
    {
      data: {
        rows: result.rows,
        total: result.total,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      },
    },
    { status: 200 },
  )
}
