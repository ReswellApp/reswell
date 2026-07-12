import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listFbMarketplaceCatalogForAdmin } from "@/lib/db/fb-marketplace-catalog"

const listQuerySchema = z.object({
  pending_only: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
})

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = listQuerySchema.safeParse({
    pending_only: request.nextUrl.searchParams.get("pending_only") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 })
  }

  const result = await listFbMarketplaceCatalogForAdmin(gate.ctx.supabase, {
    pendingOnly: parsed.data.pending_only,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ rows: result.rows })
}
