import type { SupabaseClient, User } from "@supabase/supabase-js"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import {
  persistWalletAggregatesIfNeeded,
  type WalletReconcilePersistRow,
} from "@/lib/services/walletReconcile"

export type HeaderProfileBootstrap = {
  is_admin: boolean | null
  avatar_url: string | null
  display_name: string | null
  shop_logo_url: string | null
  is_shop: boolean | null
  unread_message_count: number | null
}

export type HeaderSiteBootstrap = {
  profile: HeaderProfileBootstrap | null
  unreadMessages: number
  walletBalance: number | null
}

/**
 * Parallel header queries — one round-trip worth of latency for nav wallet/unread/profile.
 * Server-only orchestration; uses the same RLS-bound client as `getCachedRequestSession`.
 */
export async function fetchHeaderSiteBootstrap(
  supabase: SupabaseClient,
  user: User,
): Promise<HeaderSiteBootstrap> {
  const [profileRes, walletRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "is_admin, avatar_url, display_name, shop_logo_url, is_shop, unread_message_count",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("wallets")
      .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
      .eq("user_id", user.id)
      .single(),
  ])

  const profile = profileRes.data ?? null
  let wallet = walletRes.data
  if (wallet?.id) {
    const agg = reconcileWalletAggregates(wallet)
    if (agg.needsPersist) {
      await persistWalletAggregatesIfNeeded(supabase, wallet as WalletReconcilePersistRow)
      const s = walletAggregateStrings(agg)
      wallet = {
        ...wallet,
        balance: s.balance,
        pending_balance: s.pending_balance,
        lifetime_cashed_out: s.lifetime_cashed_out,
      }
    }
  }
  return {
    profile,
    unreadMessages: Number(profile?.unread_message_count ?? 0),
    walletBalance: wallet ? reconcileWalletAggregates(wallet).totalBalance : 0,
  }
}
