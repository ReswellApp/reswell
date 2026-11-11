import type { SupabaseClient } from "@supabase/supabase-js"

export type ReswellCreditWalletRow = {
  id: string
  user_id: string
  balance_cents: number
  lifetime_earned_cents: number
  lifetime_spent_cents: number
  created_at?: string
  updated_at?: string
}

export type ReswellCreditTransactionRow = {
  id: string
  wallet_id: string
  user_id: string
  type: "earn" | "spend_hold" | "spend" | "release" | "clawback" | "grant"
  amount_cents: number
  balance_after_cents: number
  description: string
  reference_type: string | null
  reference_id: string | null
  status: "posted" | "held" | "released" | "finalized"
  created_at: string
}

function asInt(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function mapWallet(row: Record<string, unknown>): ReswellCreditWalletRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    balance_cents: asInt(row.balance_cents),
    lifetime_earned_cents: asInt(row.lifetime_earned_cents),
    lifetime_spent_cents: asInt(row.lifetime_spent_cents),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  }
}

function mapTx(row: Record<string, unknown>): ReswellCreditTransactionRow {
  return {
    id: String(row.id),
    wallet_id: String(row.wallet_id),
    user_id: String(row.user_id),
    type: row.type as ReswellCreditTransactionRow["type"],
    amount_cents: asInt(row.amount_cents),
    balance_after_cents: asInt(row.balance_after_cents),
    description: String(row.description ?? ""),
    reference_type: typeof row.reference_type === "string" ? row.reference_type : null,
    reference_id: typeof row.reference_id === "string" ? row.reference_id : null,
    status: row.status as ReswellCreditTransactionRow["status"],
    created_at: String(row.created_at),
  }
}

export async function fetchReswellCreditWalletForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReswellCreditWalletRow | null> {
  const { data, error } = await supabase
    .from("reswell_credit_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) return null
  return mapWallet(data as Record<string, unknown>)
}

export async function listReswellCreditTransactionsForUser(
  supabase: SupabaseClient,
  userId: string,
  opts?: { limit?: number },
): Promise<ReswellCreditTransactionRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100)
  const { data, error } = await supabase
    .from("reswell_credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((row) => mapTx(row as Record<string, unknown>))
}

export type ReswellCreditRpcResult = {
  ok: boolean
  replayed?: boolean
  noop?: boolean
  released?: boolean
  transaction_id?: string
  spend_transaction_id?: string
  balance_cents?: number
  amount_cents?: number
  status?: string
}

function parseRpc(data: unknown): ReswellCreditRpcResult {
  if (!data || typeof data !== "object") return { ok: false }
  const row = data as Record<string, unknown>
  return {
    ok: row.ok === true,
    replayed: row.replayed === true,
    noop: row.noop === true,
    released: row.released === true,
    transaction_id: typeof row.transaction_id === "string" ? row.transaction_id : undefined,
    spend_transaction_id:
      typeof row.spend_transaction_id === "string" ? row.spend_transaction_id : undefined,
    balance_cents: row.balance_cents != null ? asInt(row.balance_cents) : undefined,
    amount_cents: row.amount_cents != null ? asInt(row.amount_cents) : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  }
}

export async function rpcAwardReswellCredit(
  supabase: SupabaseClient,
  params: {
    userId: string
    amountCents: number
    description: string
    referenceType: string
    referenceId: string
    type?: "earn" | "grant"
  },
): Promise<ReswellCreditRpcResult> {
  const { data, error } = await supabase.rpc("award_reswell_credit", {
    p_user_id: params.userId,
    p_amount_cents: params.amountCents,
    p_description: params.description,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_type: params.type ?? "earn",
  })
  if (error) throw error
  return parseRpc(data)
}

export async function rpcHoldReswellCreditForPaymentIntent(
  supabase: SupabaseClient,
  params: {
    userId: string
    amountCents: number
    paymentIntentId: string
    description?: string
  },
): Promise<ReswellCreditRpcResult> {
  const { data, error } = await supabase.rpc("hold_reswell_credit_for_payment_intent", {
    p_user_id: params.userId,
    p_amount_cents: params.amountCents,
    p_payment_intent_id: params.paymentIntentId,
    p_description: params.description ?? "Reswell Credit applied at checkout",
  })
  if (error) throw error
  return parseRpc(data)
}

export async function rpcReleaseReswellCreditHold(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<ReswellCreditRpcResult> {
  const { data, error } = await supabase.rpc("release_reswell_credit_hold", {
    p_payment_intent_id: paymentIntentId,
  })
  if (error) throw error
  return parseRpc(data)
}

export async function rpcFinalizeReswellCreditHold(
  supabase: SupabaseClient,
  params: { paymentIntentId: string; orderId: string },
): Promise<ReswellCreditRpcResult> {
  const { data, error } = await supabase.rpc("finalize_reswell_credit_hold", {
    p_payment_intent_id: params.paymentIntentId,
    p_order_id: params.orderId,
  })
  if (error) throw error
  return parseRpc(data)
}
