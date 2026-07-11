import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createAdminIssuedPromoCode } from "@/lib/services/adminIssuedPromo"
import { listAdminIssuedPromoCodes } from "@/lib/services/adminIssuedPromoCodesList"
import { adminIssuedPromoGenerateBodySchema } from "@/lib/validations/adminIssuedPromo"

const querySchema = z.object({
  status: z.enum(["all", "active", "reserved", "redeemed", "expired"]).optional().default("all"),
  q: z.string().optional(),
  sort: z
    .enum(["created_at", "expires_at", "redeemed_at", "code", "discount_percent"])
    .optional()
    .default("created_at"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

/**
 * GET /api/admin/promo-codes/admin-issued
 *
 * Paginated admin-issued one-time promo codes (admin only).
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

  const result = await listAdminIssuedPromoCodes(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}

/**
 * POST /api/admin/promo-codes/admin-issued
 *
 * Generate a one-time admin promo code with a custom discount percentage.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminIssuedPromoGenerateBodySchema.safeParse(raw)
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.discount_percent?.[0] ??
      parsed.error.flatten().fieldErrors.note?.[0] ??
      "Invalid request."
    return NextResponse.json({ error: first }, { status: 400 })
  }

  const result = await createAdminIssuedPromoCode({
    discountPercent: parsed.data.discount_percent,
    createdByProfileId: gate.ctx.user.id,
    note: parsed.data.note,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(
    {
      data: {
        id: result.promo.id,
        code: result.promo.code,
        discountPercent: result.promo.discount_percent,
        note: result.promo.note,
        expiresAt: result.promo.expires_at,
        createdAt: result.promo.created_at,
      },
    },
    { status: 201 },
  )
}
