import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { listAdminWalletBalancesForAllUsers } from "@/lib/services/adminWalletBalancesList"

/**
 * GET /api/admin/wallet-balances
 *
 * Full admin only — merged profile list with stored wallet balances (service role).
 */
export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const result = await listAdminWalletBalancesForAllUsers()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ data: result.data }, { status: 200 })
}
