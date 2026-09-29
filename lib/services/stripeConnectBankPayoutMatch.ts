/**
 * Match Reswell cash-out rows to Stripe Connect payouts.
 *
 * Standard (free) cash-outs only transfer funds onto the connected account. Stripe's
 * automatic payout schedule then sweeps that balance — often several cash-outs in one ACH.
 * A payout explains a cash-out only when the amounts line up exactly, oldest first.
 * Failed payouts do not consume the balance: Stripe returns it and retries.
 */

export const BANK_PAYOUT_STATUSES = ["pending", "in_transit", "paid", "failed", "canceled"] as const

export type BankPayoutStatus = (typeof BANK_PAYOUT_STATUSES)[number]

export interface MatchTransfer {
  id: string
  amountCents: number
  createdAtMs: number
  payoutSpeed: "standard" | "instant"
  status: string
  stripePayoutId: string | null
  bankPayoutStatus: BankPayoutStatus | null
  expectedArrivalAtIso: string | null
  bankPaidAtIso: string | null
}

export interface MatchPayout {
  id: string
  amountCents: number
  createdAtMs: number
  /** UTC midnight of Stripe's expected bank deposit date. */
  arrivalDateMs: number | null
  status: BankPayoutStatus
  method: "standard" | "instant"
  /** `metadata.reswell_connect_transfer_id` when we created the payout ourselves. */
  transferRowId: string | null
}

export interface BankPayoutAssignment {
  transferId: string
  stripePayoutId: string
  bankPayoutStatus: BankPayoutStatus
  expectedArrivalAtIso: string | null
}

export interface BankPayoutPatch {
  transferId: string
  stripePayoutId: string
  bankPayoutStatus: BankPayoutStatus
  expectedArrivalAtIso: string | null
  /** Null clears a previous paid timestamp when a retry replaces a failed attempt. */
  bankPaidAtIso: string | null
}

export function usdToCents(amount: string | number | null | undefined): number {
  if (amount == null || amount === "") return 0
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function stripeArrivalDateToIso(arrivalDateMs: number | null): string | null {
  if (arrivalDateMs == null || !Number.isFinite(arrivalDateMs) || arrivalDateMs <= 0) return null
  return new Date(arrivalDateMs).toISOString()
}

function isInstantSpeed(speed: string | null | undefined): boolean {
  return speed?.toLowerCase() === "instant"
}

function assignmentFor(transferId: string, payout: MatchPayout): BankPayoutAssignment {
  return {
    transferId,
    stripePayoutId: payout.id,
    bankPayoutStatus: payout.status,
    expectedArrivalAtIso: stripeArrivalDateToIso(payout.arrivalDateMs),
  }
}

function byTimeThenId<T extends { createdAtMs: number; id: string }>(a: T, b: T): number {
  return a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id)
}

/**
 * Oldest still-unassigned standard transfers created before the payout, whose cents
 * sum exactly to `targetCents`. Returns the exclusive end index, or null.
 */
function exactPrefixEnd(
  queue: MatchTransfer[],
  start: number,
  payoutCreatedAtMs: number,
  targetCents: number,
): number | null {
  if (targetCents <= 0) return null
  let sum = 0
  for (let i = start; i < queue.length; i++) {
    const transfer = queue[i]
    if (!transfer || transfer.createdAtMs > payoutCreatedAtMs) return null
    sum += transfer.amountCents
    if (sum === targetCents) return i + 1
    if (sum > targetCents) return null
  }
  return null
}

function isOpenStandardTransfer(transfer: MatchTransfer): boolean {
  return (
    !isInstantSpeed(transfer.payoutSpeed) &&
    transfer.status.toUpperCase() === "SUCCEEDED" &&
    transfer.amountCents > 0 &&
    transfer.bankPayoutStatus !== "paid"
  )
}

export function matchStripeConnectBankPayouts(
  transfers: MatchTransfer[],
  payouts: MatchPayout[],
): BankPayoutAssignment[] {
  const payoutById = new Map(payouts.map((payout) => [payout.id, payout]))
  const payoutByTransferRowId = new Map<string, MatchPayout>()
  for (const payout of payouts) {
    if (payout.transferRowId && !payoutByTransferRowId.has(payout.transferRowId)) {
      payoutByTransferRowId.set(payout.transferRowId, payout)
    }
  }

  const assigned = new Map<string, BankPayoutAssignment>()

  const resolveDirectPayout = (transfer: MatchTransfer): MatchPayout | null => {
    const linkedId = transfer.stripePayoutId?.trim()
    if (linkedId) {
      const linked = payoutById.get(linkedId)
      if (linked) return linked
    }
    return payoutByTransferRowId.get(transfer.id) ?? null
  }

  // Instant rows are created with their own payout. Paid standard rows are closed.
  // In-flight standard rows stay in the sweep so a batched payout can still pick up
  // siblings if an earlier sync saved only part of the batch.
  for (const transfer of transfers) {
    const payout = resolveDirectPayout(transfer)
    if (!payout) continue
    const instant = isInstantSpeed(transfer.payoutSpeed)
    if (!instant && transfer.bankPayoutStatus !== "paid") continue
    if (!instant && payout.method === "instant") continue
    if (!instant && (payout.status === "failed" || payout.status === "canceled")) continue
    assigned.set(transfer.id, assignmentFor(transfer.id, payout))
  }

  const openQueue = transfers.filter((transfer) => isOpenStandardTransfer(transfer)).sort(byTimeThenId)

  const paidStandard = transfers.filter(
    (transfer) =>
      !isInstantSpeed(transfer.payoutSpeed) &&
      transfer.status.toUpperCase() === "SUCCEEDED" &&
      transfer.bankPayoutStatus === "paid" &&
      Boolean(transfer.stripePayoutId?.trim()),
  )

  const standardPayouts = payouts
    .filter((payout) => payout.method !== "instant" && payout.amountCents > 0)
    .sort(byTimeThenId)

  let queueIndex = 0
  const reservedPayoutIds = new Set<string>()

  for (const payout of standardPayouts) {
    if (payout.status === "failed" || payout.status === "canceled") continue

    const alreadyCents = paidStandard
      .filter(
        (transfer) =>
          transfer.stripePayoutId === payout.id && transfer.createdAtMs <= payout.createdAtMs,
      )
      .reduce((sum, transfer) => sum + transfer.amountCents, 0)

    if (alreadyCents > payout.amountCents) {
      reservedPayoutIds.add(payout.id)
      continue
    }
    if (alreadyCents === payout.amountCents) {
      reservedPayoutIds.add(payout.id)
      continue
    }

    const end = exactPrefixEnd(openQueue, queueIndex, payout.createdAtMs, payout.amountCents - alreadyCents)
    if (end == null) continue

    for (let i = queueIndex; i < end; i++) {
      const transfer = openQueue[i]
      if (!transfer) continue
      assigned.set(transfer.id, assignmentFor(transfer.id, payout))
    }
    reservedPayoutIds.add(payout.id)
    queueIndex = end
  }

  const failedPayouts = standardPayouts.filter(
    (payout) =>
      (payout.status === "failed" || payout.status === "canceled") && !reservedPayoutIds.has(payout.id),
  )

  for (const payout of failedPayouts) {
    const end = exactPrefixEnd(openQueue, queueIndex, payout.createdAtMs, payout.amountCents)
    if (end == null) continue
    for (let i = queueIndex; i < end; i++) {
      const transfer = openQueue[i]
      if (!transfer) continue
      assigned.set(transfer.id, assignmentFor(transfer.id, payout))
    }
    queueIndex = end
  }

  // Keep a known in-flight link when this payout list could not re-explain the row.
  for (const transfer of transfers) {
    if (assigned.has(transfer.id) || !isOpenStandardTransfer(transfer)) continue
    const payout = resolveDirectPayout(transfer)
    if (!payout || payout.method === "instant" || reservedPayoutIds.has(payout.id)) continue
    if (payout.status === "failed" || payout.status === "canceled") continue
    assigned.set(transfer.id, assignmentFor(transfer.id, payout))
  }

  return [...assigned.values()]
}

function sameInstant(left: string | null | undefined, right: string | null): boolean {
  if (!left && !right) return true
  if (!left || !right) return false
  const leftMs = Date.parse(left)
  const rightMs = Date.parse(right)
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return left === right
  return leftMs === rightMs
}

/**
 * Diff matcher output against stored rows. Paid rows never move backward.
 * A new payout id may replace a failed or in-flight attempt.
 */
export function planStripeConnectBankPayoutUpdates(
  transfers: MatchTransfer[],
  assignments: BankPayoutAssignment[],
  nowIso: string,
): BankPayoutPatch[] {
  const byId = new Map(transfers.map((transfer) => [transfer.id, transfer]))
  const patches: BankPayoutPatch[] = []

  for (const assignment of assignments) {
    const current = byId.get(assignment.transferId)
    if (!current) continue
    if (current.bankPayoutStatus === "paid" && assignment.bankPayoutStatus !== "paid") continue

    const samePayout = current.stripePayoutId?.trim() === assignment.stripePayoutId
    if (
      samePayout &&
      current.bankPayoutStatus === "in_transit" &&
      assignment.bankPayoutStatus === "pending"
    ) {
      continue
    }
    if (
      samePayout &&
      (current.bankPayoutStatus === "failed" || current.bankPayoutStatus === "canceled") &&
      assignment.bankPayoutStatus !== "paid" &&
      assignment.bankPayoutStatus !== "in_transit" &&
      assignment.bankPayoutStatus !== "pending"
    ) {
      continue
    }

    const nextPaidAt =
      assignment.bankPayoutStatus === "paid"
        ? (current.bankPaidAtIso ?? assignment.expectedArrivalAtIso ?? nowIso)
        : null

    const unchanged =
      samePayout &&
      current.bankPayoutStatus === assignment.bankPayoutStatus &&
      sameInstant(current.expectedArrivalAtIso, assignment.expectedArrivalAtIso) &&
      sameInstant(current.bankPaidAtIso, nextPaidAt)

    if (unchanged) continue

    patches.push({
      transferId: assignment.transferId,
      stripePayoutId: assignment.stripePayoutId,
      bankPayoutStatus: assignment.bankPayoutStatus,
      expectedArrivalAtIso: assignment.expectedArrivalAtIso,
      bankPaidAtIso: nextPaidAt,
    })
  }

  return patches
}
