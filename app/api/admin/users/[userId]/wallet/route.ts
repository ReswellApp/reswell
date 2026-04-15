import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAdminUserWalletSummary,
  resetUserWalletEarningsToZeroService,
} from "@/lib/services/adminUserWallet"
import { adminWalletUserIdParamSchema } from "@/lib/validations/admin-user-wallet"

async function requireIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

  if (!profile?.is_admin) return null
  return user
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()
  const admin = await requireIsAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId: rawId } = await context.params
  const parsed = adminWalletUserIdParamSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  const result = await getAdminUserWalletSummary(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()
  const admin = await requireIsAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId: rawId } = await context.params
  const parsed = adminWalletUserIdParamSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  const targetUserId = parsed.data

  const result = await resetUserWalletEarningsToZeroService(targetUserId, { adminId: admin.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  const summary = await getAdminUserWalletSummary(targetUserId)
  if (summary.ok) {
    return NextResponse.json({ success: true, data: summary.data }, { status: 200 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
