import type { SupabaseClient } from "@supabase/supabase-js"

const ADMIN_WALLET_BALANCES_PAGE_SIZE = 1000

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

async function dbListAllProfilesForAdmin(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; data: AdminWalletBalancesProfileRow[] }
  | { ok: false; message: string }
> {
  const rows: AdminWalletBalancesProfileRow[] = []

  for (let from = 0; ; from += ADMIN_WALLET_BALANCES_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + ADMIN_WALLET_BALANCES_PAGE_SIZE - 1)

    if (error) {
      console.error("[admin wallet balances] profiles", error)
      return { ok: false, message: "Could not load profiles" }
    }

    const page = (data ?? []) as AdminWalletBalancesProfileRow[]
    rows.push(...page)
    if (page.length < ADMIN_WALLET_BALANCES_PAGE_SIZE) break
  }

  return { ok: true, data: rows }
}

async function dbListAllWalletsForAdmin(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; data: AdminWalletBalancesWalletRow[] }
  | { ok: false; message: string }
> {
  const rows: AdminWalletBalancesWalletRow[] = []

  for (let from = 0; ; from += ADMIN_WALLET_BALANCES_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("wallets")
      .select("id, user_id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
      .order("user_id", { ascending: true })
      .range(from, from + ADMIN_WALLET_BALANCES_PAGE_SIZE - 1)

    if (error) {
      console.error("[admin wallet balances] wallets", error)
      return { ok: false, message: "Could not load wallets" }
    }

    const page = (data ?? []) as AdminWalletBalancesWalletRow[]
    rows.push(...page)
    if (page.length < ADMIN_WALLET_BALANCES_PAGE_SIZE) break
  }

  return { ok: true, data: rows }
}

export async function dbListProfilesAndWalletsForAdmin(supabase: SupabaseClient): Promise<
  | { ok: true; profiles: AdminWalletBalancesProfileRow[]; wallets: AdminWalletBalancesWalletRow[] }
  | { ok: false; message: string }
> {
  const [profiles, wallets] = await Promise.all([
    dbListAllProfilesForAdmin(supabase),
    dbListAllWalletsForAdmin(supabase),
  ])

  if (!profiles.ok) {
    return profiles
  }
  if (!wallets.ok) {
    return wallets
  }

  return {
    ok: true,
    profiles: profiles.data,
    wallets: wallets.data,
  }
}
