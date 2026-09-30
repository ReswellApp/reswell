import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listStripeConnectTransfersForUser,
  updateStripeConnectTransferBankPayout,
  type StripeConnectTransferRow,
} from "@/lib/db/stripeConnect"
import { getStripe } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  BANK_PAYOUT_STATUSES,
  matchStripeConnectBankPayouts,
  planStripeConnectBankPayoutUpdates,
  usdToCents,
  type BankPayoutStatus,
  type MatchPayout,
  type MatchTransfer,
} from "@/lib/services/stripeConnectBankPayoutMatch"

const TRANSFER_LIMIT = 500
const PAYOUT_PAGE_SIZE = 100
const MAX_PAYOUT_PAGES = 5

function bankStatusFromRow(value: string | null | undefined): BankPayoutStatus | null {
  if (!value) return null
  return (BANK_PAYOUT_STATUSES as readonly string[]).includes(value) ? (value as BankPayoutStatus) : null
}

function rowToMatchTransfer(row: StripeConnectTransferRow): MatchTransfer {
  return {
    id: row.id,
    amountCents: usdToCents(row.amount),
    createdAtMs: Date.parse(row.created_at),
    payoutSpeed: row.payout_speed?.toLowerCase() === "instant" ? "instant" : "standard",
    status: row.status,
    stripePayoutId: row.stripe_payout_id?.trim() || null,
    bankPayoutStatus: bankStatusFromRow(row.bank_payout_status),
    expectedArrivalAtIso: row.expected_arrival_at ?? null,
  }
}

function payoutToMatch(payout: Stripe.Payout): MatchPayout | null {
  const status = payout.status
  if (!(BANK_PAYOUT_STATUSES as readonly string[]).includes(status)) return null
  const transferRowId =
    typeof payout.metadata?.reswell_connect_transfer_id === "string"
      ? payout.metadata.reswell_connect_transfer_id.trim()
      : ""
  return {
    id: payout.id,
    amountCents: payout.amount,
    createdAtMs: payout.created * 1000,
    arrivalDateMs: payout.arrival_date > 0 ? payout.arrival_date * 1000 : null,
    status: status as BankPayoutStatus,
    method: payout.method === "instant" ? "instant" : "standard",
    transferRowId: transferRowId || null,
  }
}

function needsBankSync(row: StripeConnectTransferRow): boolean {
  return row.status.toUpperCase() === "SUCCEEDED" && row.bank_payout_status !== "paid"
}

async function listConnectedPayouts(
  stripe: Stripe,
  stripeAccountId: string,
  createdGteSeconds: number | null,
): Promise<Stripe.Payout[]> {
  const payouts: Stripe.Payout[] = []
  let startingAfter: string | undefined

  for (let page = 0; page < MAX_PAYOUT_PAGES; page++) {
    const listed = await stripe.payouts.list(
      {
        limit: PAYOUT_PAGE_SIZE,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        ...(createdGteSeconds != null ? { created: { gte: createdGteSeconds } } : {}),
      },
      { stripeAccount: stripeAccountId },
    )
    payouts.push(...listed.data)
    if (!listed.has_more || listed.data.length === 0) break
    const last = listed.data[listed.data.length - 1]
    if (!last) break
    startingAfter = last.id
  }

  return payouts
}

/**
 * Pull connected-account payouts and store deposit status on cash-out rows.
 * Safe to call on every Earnings load: no-ops once every row is paid, and never
 * moves a paid row backward.
 */
export async function syncStripeConnectBankPayoutsForUser(
  userId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const db = supabase ?? createServiceRoleClient()
  const rows = await listStripeConnectTransfersForUser(db, userId, TRANSFER_LIMIT)
  if (rows.length === TRANSFER_LIMIT) {
    console.warn("[stripe connect] bank payout sync hit transfer cap", { userId, limit: TRANSFER_LIMIT })
  }
  if (!rows.some(needsBankSync)) return

  const { data: account, error: accountError } = await db
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (accountError) {
    console.error("[stripe connect] bank payout sync account lookup", accountError)
    return
  }

  const stripeAccountId = typeof account?.stripe_account_id === "string" ? account.stripe_account_id : ""
  if (!stripeAccountId) return

  const oldestOpen = rows
    .filter(needsBankSync)
    .reduce<number | null>((oldest, row) => {
      const ms = Date.parse(row.created_at)
      if (!Number.isFinite(ms)) return oldest
      return oldest == null || ms < oldest ? ms : oldest
    }, null)

  const createdGteSeconds = oldestOpen == null ? null : Math.floor(oldestOpen / 1000) - 86_400
  const stripe = getStripe()
  const payouts = (await listConnectedPayouts(stripe, stripeAccountId, createdGteSeconds))
    .map(payoutToMatch)
    .filter((payout): payout is MatchPayout => payout != null)

  const transfers = rows.map(rowToMatchTransfer)
  const assignments = matchStripeConnectBankPayouts(transfers, payouts)
  const patches = planStripeConnectBankPayoutUpdates(transfers, assignments)

  for (const patch of patches) {
    const saved = await updateStripeConnectTransferBankPayout(
      db,
      patch.transferId,
      {
        stripe_payout_id: patch.stripePayoutId,
        bank_payout_status: patch.bankPayoutStatus,
        expected_arrival_at: patch.expectedArrivalAtIso,
      },
      { protectPaid: patch.bankPayoutStatus !== "paid" },
    )
    if (!saved) {
      console.error("[stripe connect] bank payout status not saved", {
        userId,
        transferId: patch.transferId,
        bankPayoutStatus: patch.bankPayoutStatus,
      })
    }
  }
}
