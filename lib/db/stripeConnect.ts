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
  /** Stripe payout status for the deposit to the seller's bank. Null until a po_ is matched. */
  bank_payout_status?: string | null
  /** Stripe payout.arrival_date, as an ISO timestamp (UTC midnight of that day). */
  expected_arrival_at?: string | null
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

export async function listStripeConnectTransfersByPayoutId(
  supabase: SupabaseClient,
  stripePayoutId: string,
): Promise<StripeConnectTransferRow[]> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .select("*")
    .eq("stripe_payout_id", stripePayoutId)

  if (error) {
    console.error("[stripe connect db] listStripeConnectTransfersByPayoutId", error)
    return []
  }
  return (data ?? []) as StripeConnectTransferRow[]
}

export async function listStripeConnectTransfersForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 500,
): Promise<StripeConnectTransferRow[]> {
  const { data, error } = await supabase
    .from("stripe_connect_transfers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[stripe connect db] listStripeConnectTransfersForUser", error)
    return []
  }
  return (data ?? []) as StripeConnectTransferRow[]
}

export async function updateStripeConnectTransferBankPayout(
  supabase: SupabaseClient,
  transferId: string,
  patch: {
    stripe_payout_id: string
    bank_payout_status: string
    expected_arrival_at: string | null
  },
  options?: { protectPaid?: boolean },
): Promise<boolean> {
  let query = supabase
    .from("stripe_connect_transfers")
    .update({
      stripe_payout_id: patch.stripe_payout_id,
      bank_payout_status: patch.bank_payout_status,
      expected_arrival_at: patch.expected_arrival_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferId)

  if (options?.protectPaid) {
    query = query.or("bank_payout_status.is.null,bank_payout_status.neq.paid")
  }

  const { data, error } = await query.select("id").maybeSingle()

  if (error) {
    console.error("[stripe connect db] updateStripeConnectTransferBankPayout", error)
    return false
  }
  return Boolean(data)
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
