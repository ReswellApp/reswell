import type { SupabaseClient } from "@supabase/supabase-js"

export interface StripeConnectAccountRow {
  user_id: string
  stripe_account_id: string
  payouts_enabled: boolean
  details_submitted: boolean
  default_external_account_id: string | null
  bank_last4: string | null
  bank_name: string | null
  updated_at: string
  created_at: string
}

export interface StripeConnectTransferRow {
  id: string
  user_id: string
  amount: string | number
  fee_amount?: string | number | null
  payout_speed?: string | null
  stripe_transfer_id: string | null
  stripe_payout_id?: string | null
  status: string
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export async function getStripeConnectAccountByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<StripeConnectAccountRow | null> {
  const { data, error } = await supabase
    .from("stripe_connect_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[stripe connect db] getStripeConnectAccountByUserId", error)
    return null
  }
  return data as StripeConnectAccountRow | null
}

export async function insertStripeConnectAccount(
  supabase: SupabaseClient,
  row: Pick<StripeConnectAccountRow, "user_id" | "stripe_account_id">,
): Promise<StripeConnectAccountRow | null> {
  const { data, error } = await supabase
    .from("stripe_connect_accounts")
    .insert({
      user_id: row.user_id,
      stripe_account_id: row.stripe_account_id,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[stripe connect db] insertStripeConnectAccount", error)
    return null
  }
  return data as StripeConnectAccountRow
}

export async function updateStripeConnectAccountByStripeId(
  supabase: SupabaseClient,
  stripeAccountId: string,
  patch: Partial<
    Pick<
      StripeConnectAccountRow,
      | "payouts_enabled"
      | "details_submitted"
      | "default_external_account_id"
      | "bank_last4"
      | "bank_name"
    >
  >,
): Promise<void> {
  const { error } = await supabase
    .from("stripe_connect_accounts")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", stripeAccountId)

  if (error) {
    console.error("[stripe connect db] updateStripeConnectAccountByStripeId", error)
  }
}

export async function getStripeConnectTransferByStripeId(
  supabase: SupabaseClient,
  stripeTransferId: string,
): Promise<StripeConnectTransferRow | null> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .select("*")
    .eq("stripe_transfer_id", stripeTransferId)
    .maybeSingle()

  if (error) {
    console.error("[stripe connect db] getStripeConnectTransferByStripeId", error)
    return null
  }
  return data as StripeConnectTransferRow | null
}
