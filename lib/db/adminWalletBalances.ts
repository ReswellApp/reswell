import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminWalletBalancesProfileRow = {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export type AdminWalletBalancesWalletRow = {
  id: string
  user_id: string
  balance: string | number | null
  pending_balance: string | number | null
  lifetime_earned: string | number | null
  lifetime_spent: string | number | null
  lifetime_cashed_out: string | number | null
}

export async function dbListProfilesAndWalletsForAdmin(supabase: SupabaseClient): Promise<
  | { ok: true; profiles: AdminWalletBalancesProfileRow[]; wallets: AdminWalletBalancesWalletRow[] }
  | { ok: false; message: string }
> {
  const [{ data: profiles, error: profileError }, { data: wallets, error: walletError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("wallets")
        .select("id, user_id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out"),
    ])

  if (profileError) {
    console.error("[admin wallet balances] profiles", profileError)
    return { ok: false, message: "Could not load profiles" }
  }
  if (walletError) {
    console.error("[admin wallet balances] wallets", walletError)
    return { ok: false, message: "Could not load wallets" }
  }

  return {
    ok: true,
    profiles: (profiles ?? []) as AdminWalletBalancesProfileRow[],
    wallets: (wallets ?? []) as AdminWalletBalancesWalletRow[],
  }
}
