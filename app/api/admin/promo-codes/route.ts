import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listAdminPromoCodes } from "@/lib/services/adminPromoCodesList"

const querySchema = z.object({
  status: z.enum(["all", "active", "reserved", "redeemed", "expired"]).optional().default("all"),
  q: z.string().optional(),
  sort: z
    .enum(["created_at", "expires_at", "redeemed_at", "code", "email"])
    .optional()
    .default("created_at"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/admin/promo-codes
 *
 * Paginated newsletter promo code list with redemption order details (admin only).
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const result = await listAdminPromoCodes(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
