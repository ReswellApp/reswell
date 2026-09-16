import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  applyAdminAccountBan,
  loadAdminAccountBan,
} from "@/lib/services/banUserAccount"
import { adminAccountBanPatchSchema } from "@/lib/validations/admin-account-ban"

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { userId } = await context.params
  const result = await loadAdminAccountBan(userId)
  if (!result.ok) {
    const status = result.error === "User not found." ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ data: result.state }, { status: 200 })
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

  const parsed = adminAccountBanPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await applyAdminAccountBan({
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
        bannedUntil: result.bannedUntil,
        reason: result.reason,
        affectedListingCount: result.affectedListingIds.length,
        restrictedUntil: result.restrictedUntil,
        sellerBannedAt: result.sellerBannedAt,
        sellerBannedReason: result.sellerBannedReason,
      },
    },
    { status: 200 },
  )
}
