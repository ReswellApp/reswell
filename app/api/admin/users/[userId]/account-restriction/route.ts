import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  applyAdminAccountRestriction,
  loadAdminAccountRestriction,
} from "@/lib/services/accountRestrictions"
import { adminAccountRestrictionPatchSchema } from "@/lib/validations/admin-account-restriction"

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { userId } = await context.params
  const result = await loadAdminAccountRestriction(userId)
  if (!result.ok) {
    const status = result.error === "User not found." ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ data: result }, { status: 200 })
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

  const parsed = adminAccountRestrictionPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!parsed.data.restricted) {
    const result = await applyAdminAccountRestriction({
      userId,
      restrictedUntil: null,
      reason: null,
    })
    if (!result.ok) {
      const status = result.error === "User not found." ? 404 : 500
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ success: true, data: result }, { status: 200 })
  }

  let restrictedUntil: string | null = parsed.data.restrictedUntil ?? null
  if (!restrictedUntil && parsed.data.durationMinutes) {
    restrictedUntil = new Date(Date.now() + parsed.data.durationMinutes * 60_000).toISOString()
  }

  const result = await applyAdminAccountRestriction({
    userId,
    restrictedUntil,
    reason: parsed.data.reason?.trim() || null,
  })

  if (!result.ok) {
    const status = result.error === "User not found." ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ success: true, data: result }, { status: 200 })
}
