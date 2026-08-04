import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  applyAdminSellerBan,
  loadAdminSellerBan,
} from "@/lib/services/sellerBan"
import { adminSellerBanPatchSchema } from "@/lib/validations/admin-seller-ban"

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { userId } = await context.params
  const result = await loadAdminSellerBan(userId)
  if (!result.ok) {
    const status = result.error === "User not found." ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(
    {
      data: {
        sellerBannedAt: result.state.sellerBannedAt,
        sellerBannedReason: result.state.sellerBannedReason,
        banned: Boolean(result.state.sellerBannedAt),
      },
    },
    { status: 200 },
  )
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { userId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = adminSellerBanPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await applyAdminSellerBan({
    userId,
    banned: parsed.data.banned,
    reason: parsed.data.banned ? parsed.data.reason?.trim() || null : null,
    actorUserId: gate.ctx.user.id,
  })

  if (!result.ok) {
    const status =
      result.error === "User not found."
        ? 404
        : result.error.includes("Admin accounts")
          ? 400
          : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        banned: result.banned,
        sellerBannedAt: result.sellerBannedAt,
        sellerBannedReason: result.sellerBannedReason,
        affectedListingCount: result.affectedListingIds.length,
      },
    },
    { status: 200 },
  )
}
