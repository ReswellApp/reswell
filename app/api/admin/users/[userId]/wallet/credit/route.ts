import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import {
  creditAdminUserWalletService,
  getAdminUserWalletSummary,
} from "@/lib/services/adminUserWallet"
import { adminWalletUserIdParamSchema } from "@/lib/validations/admin-user-wallet"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { userId: rawId } = await context.params
  const parsedId = adminWalletUserIdParamSchema.safeParse(rawId)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const result = await creditAdminUserWalletService(parsedId.data, body, {
    adminId: gate.ctx.user.id,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  const summary = await getAdminUserWalletSummary(parsedId.data)
  if (summary.ok) {
    return NextResponse.json(
      { success: true, data: summary.data, amount_usd: result.amountUsd },
      { status: 200 },
    )
  }

  return NextResponse.json(
    { success: true, amount_usd: result.amountUsd },
    { status: 200 },
  )
}
