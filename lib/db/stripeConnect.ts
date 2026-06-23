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

export async function getStripeConnectTransferByPayoutId(
  supabase: SupabaseClient,
  stripePayoutId: string,
): Promise<StripeConnectTransferRow | null> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .select("*")
    .eq("stripe_payout_id", stripePayoutId)
    .maybeSingle()

  if (error) {
    console.error("[stripe connect db] getStripeConnectTransferByPayoutId", error)
    return null
  }
  return data as StripeConnectTransferRow | null
}

export async function getStripeConnectTransferById(
  supabase: SupabaseClient,
  transferRowId: string,
): Promise<StripeConnectTransferRow | null> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .select("*")
    .eq("id", transferRowId)
    .maybeSingle()

  if (error) {
    console.error("[stripe connect db] getStripeConnectTransferById", error)
    return null
  }
  return data as StripeConnectTransferRow | null
}

export async function insertStripeConnectTransferProcessing(
  supabase: SupabaseClient,
  row: {
    id: string
    user_id: string
    amount: number
    fee_amount: number
    payout_speed: "standard" | "instant"
    stripe_transfer_id: string
  },
): Promise<boolean> {
  const { error } = await supabase.from("stripe_connect_transfers").insert({
    id: row.id,
    user_id: row.user_id,
    amount: row.amount,
    fee_amount: row.fee_amount,
    payout_speed: row.payout_speed,
    stripe_transfer_id: row.stripe_transfer_id,
    status: "PROCESSING",
  })

  if (error) {
    console.error("[stripe connect db] insertStripeConnectTransferProcessing", error)
    return false
  }
  return true
}

export async function markStripeConnectTransferSucceeded(
  supabase: SupabaseClient,
  transferRowId: string,
  stripePayoutId: string | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .update({
      status: "SUCCEEDED",
      stripe_payout_id: stripePayoutId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferRowId)
    .eq("status", "PROCESSING")
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[stripe connect db] markStripeConnectTransferSucceeded", error)
    return false
  }
  return Boolean(data)
}

/** Idempotent: only transitions eligible statuses → REVERSED once. */
export async function markStripeConnectTransferReversed(
  supabase: SupabaseClient,
  transferRowId: string,
  failureReason: string,
  fromStatuses: Array<"PROCESSING" | "SUCCEEDED"> = ["PROCESSING"],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .update({
      status: "REVERSED",
      failure_reason: failureReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferRowId)
    .in("status", fromStatuses)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[stripe connect db] markStripeConnectTransferReversed", error)
    return false
  }
  return Boolean(data)
}
