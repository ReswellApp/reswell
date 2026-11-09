import type { SupabaseClient } from "@supabase/supabase-js"

import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"

const PENDING_LOOKBACK = 150
const RELEASED_LOOKBACK = 80

function asTxRows(data: unknown): EarningsTransaction[] {
  if (!Array.isArray(data)) return []
  return data as EarningsTransaction[]
}

/** Recent pending credits and recent unlocks for the signed-in seller's wallet. */
export async function fetchEarningsBalanceLedger(
  supabase: SupabaseClient,
  walletId: string,
): Promise<{ pending: EarningsTransaction[]; released: EarningsTransaction[] }> {
  const [pendingRes, releasedRes] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .eq("reference_type", "order_pending_earnings")
      .order("created_at", { ascending: false })
      .limit(PENDING_LOOKBACK),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .eq("reference_type", "order_seller_earnings")
      .order("created_at", { ascending: false })
      .limit(RELEASED_LOOKBACK),
  ])

  if (pendingRes.error) {
    console.error("[earningsBalanceLedger] pending:", pendingRes.error.message)
  }
  if (releasedRes.error) {
    console.error("[earningsBalanceLedger] released:", releasedRes.error.message)
  }

  const pending = asTxRows(pendingRes.data)
  const released = asTxRows(releasedRes.data)

  const pendingOrderIds = [
    ...new Set(
      pending
        .map((tx) => (typeof tx.reference_id === "string" ? tx.reference_id.trim() : ""))
        .filter(Boolean),
    ),
  ]
  const alreadyHave = new Set(
    released
      .map((tx) => (typeof tx.reference_id === "string" ? tx.reference_id.trim() : ""))
      .filter(Boolean),
  )
  const missingReleaseIds = pendingOrderIds.filter((id) => !alreadyHave.has(id))

  if (missingReleaseIds.length === 0) {
    return { pending, released }
  }

  const extraRes = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .eq("reference_type", "order_seller_earnings")
    .in("reference_id", missingReleaseIds)

  if (extraRes.error) {
    console.error("[earningsBalanceLedger] extra releases:", extraRes.error.message)
    return { pending, released }
  }

  const extra = asTxRows(extraRes.data)
  const seen = new Set(released.map((tx) => tx.id))
  for (const tx of extra) {
    if (seen.has(tx.id)) continue
    released.push(tx)
  }
  return { pending, released }
}
