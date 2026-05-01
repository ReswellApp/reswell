import { summarizeWalletBalanceRow } from "@/lib/getSellerBalance"
import { dbListProfilesAndWalletsForAdmin } from "@/lib/db/adminWalletBalances"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type AdminWalletBalanceListRow = {
  userId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: string
} & ReturnType<typeof summarizeWalletBalanceRow>

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

export async function listAdminWalletBalancesForAllUsers(): Promise<
  | { ok: true; data: AdminWalletBalanceListRow[] }
  | { ok: false; message: string; status: number }
> {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const batch = await dbListProfilesAndWalletsForAdmin(supabase)
  if (!batch.ok) {
    return { ok: false, message: batch.message, status: 500 }
  }

  const walletByUserId = new Map(
    batch.wallets.map((w) => [w.user_id, w] as const),
  )

  const data: AdminWalletBalanceListRow[] = batch.profiles.map((p) => {
    const wallet = walletByUserId.get(p.id) ?? null
    const summary = summarizeWalletBalanceRow(
      wallet
        ? {
            id: wallet.id,
            balance: wallet.balance,
            pending_balance: wallet.pending_balance,
            lifetime_earned: wallet.lifetime_earned,
            lifetime_spent: wallet.lifetime_spent,
            lifetime_cashed_out: wallet.lifetime_cashed_out,
          }
        : null,
    )
    return {
      userId: p.id,
      email: p.email,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      ...summary,
    }
  })

  return { ok: true, data }
}
