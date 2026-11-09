import { bankTransferBadge } from "@/lib/utils/stripe-connect-transfer-status"

/** Fields the history disclosure needs for its closed-state summary. */
export interface BankTransferHistorySummaryInput {
  amount: string | number
  status: string
  payout_speed?: string | null
  bank_payout_status?: string | null
  expected_arrival_at?: string | null
}

export function formatPayoutAmount(amount: string | number): string {
  const amt = typeof amount === "string" ? parseFloat(amount) : amount
  return Number.isFinite(amt) ? amt.toFixed(2) : String(amount)
}

/** Processing or failed cash-outs should start the history disclosure open. */
export function transferNeedsAttention(row: BankTransferHistorySummaryInput): boolean {
  const kind = bankTransferBadge({
    status: row.status,
    payoutSpeed: row.payout_speed,
    bankPayoutStatus: row.bank_payout_status,
    expectedArrivalAt: row.expected_arrival_at,
  }).kind
  return kind === "processing" || kind === "failed"
}

export function historyTriggerSummary(rows: BankTransferHistorySummaryInput[]): string {
  const countLabel = rows.length === 1 ? "1 transfer" : `${rows.length} transfers`
  let processing = 0
  let failed = 0
  let reversed = 0
  for (const row of rows) {
    const kind = bankTransferBadge({
      status: row.status,
      payoutSpeed: row.payout_speed,
      bankPayoutStatus: row.bank_payout_status,
      expectedArrivalAt: row.expected_arrival_at,
    }).kind
    if (kind === "processing") processing += 1
    else if (kind === "failed") failed += 1
    else if (kind === "reversed") reversed += 1
  }
  const parts = [countLabel]
  if (processing > 0) parts.push(`${processing} processing`)
  if (failed > 0) parts.push(`${failed} failed`)
  if (reversed > 0) parts.push(`${reversed} reversed`)
  const latest = rows[0]
  if (processing === 0 && failed === 0 && reversed === 0 && latest) {
    parts.push(`Latest $${formatPayoutAmount(latest.amount)}`)
  }
  return parts.join(" · ")
}
