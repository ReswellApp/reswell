/**
 * Reswell Dispute Resolution — constants and core business logic.
 *
 * Single source of truth for all dispute rules, caps, and display labels.
 * Never hardcode raw numbers elsewhere.
 */

import { RESWELL_FEE, PROTECTION_FUND_RATE } from '@/lib/protection-constants'
import type { DisputeReason, DisputeStatus, DisputeResolution } from './types'

export { RESWELL_FEE, PROTECTION_FUND_RATE }

/** Days from delivery that buyer can open a dispute */
export const DISPUTE_WINDOW_DAYS = 30

/** Hours seller has to respond before auto-escalation */
export const SELLER_RESPONSE_WINDOW_HOURS = 48

/** Calendar days buyer has to ship return after label sent */
export const RETURN_SHIP_WINDOW_DAYS = 5

/** Days seller has to confirm return receipt before auto-refund */
export const SELLER_CONFIRM_RECEIPT_DAYS = 3

/** Hours to send "1 day left" return warning before window closes */
export const RETURN_WINDOW_WARNING_HOURS = 24

/** Max disputes in 90 days before fraud flag */
export const FRAUD_MAX_DISPUTES_90D = 3

/** Distinct sellers in 90 days before fraud flag */
export const FRAUD_MAX_DISTINCT_SELLERS_90D = 3

/** Abandoned return count before fraud flag */
export const FRAUD_MAX_ABANDONED_RETURNS = 2

/** Max photos per dispute */
export const MAX_EVIDENCE_PHOTOS = 8

/** Minimum photos required (all reasons except NOT_RECEIVED) */
export const MIN_EVIDENCE_PHOTOS = 2

/** Minimum description length */
export const MIN_DESCRIPTION_CHARS = 50

/** Max item value for admin to waive return requirement on damaged items */
export const RETURN_WAIVER_MAX_VALUE = 50

// ─────────────────────────────────────────────────────────────────────────────
// Core business logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether a return is required for this dispute reason.
 * NOT_RECEIVED: no return (item never arrived).
 * All others: return required before refund is released.
 */
export function isReturnRequired(reason: DisputeReason): boolean {
  return reason !== 'NOT_RECEIVED'
}

/**
 * Calculate the approved refund amount.
 * Full refund — every dollar the customer paid — for all dispute reasons.
 * No cap per Reswell guarantee policy.
 */
export function calculateRefundAmount(
  _reason: DisputeReason,
  _claimedAmount: number,
  orderItemPrice: number,
  orderShippingCost = 0
): number {
  // Full refund — every dollar the customer paid
  // No cap per Reswell guarantee policy
  return Math.round((orderItemPrice + orderShippingCost) * 100) / 100
}

/**
 * Detect fraud flags for a new dispute.
 * Returns array of flag strings — never shown to buyer/seller.
 */
export function detectDisputeFraudFlags(opts: {
  recentDisputeCount: number
  distinctSellerCount: number
  abandonedReturnCount: number
  trackingShowsDelivered: boolean
  reason: DisputeReason
  orderAmount: number
  claimedAmount: number
  accountAgeDays: number
}): string[] {
  const flags: string[] = []

  if (opts.recentDisputeCount >= FRAUD_MAX_DISPUTES_90D) {
    flags.push(`high_dispute_frequency:${opts.recentDisputeCount}_in_90d`)
  }

  if (opts.distinctSellerCount >= FRAUD_MAX_DISTINCT_SELLERS_90D) {
    flags.push(`disputes_across_multiple_sellers:${opts.distinctSellerCount}`)
  }

  if (opts.abandonedReturnCount >= FRAUD_MAX_ABANDONED_RETURNS) {
    flags.push(`pattern_abandoned_returns:${opts.abandonedReturnCount}`)
  }

  if (opts.reason === 'NOT_RECEIVED' && opts.trackingShowsDelivered) {
    flags.push('not_received_but_tracking_shows_delivered')
  }

  if (opts.claimedAmount > opts.orderAmount * 1.1) {
    flags.push(`claimed_exceeds_order:${opts.claimedAmount}_vs_${opts.orderAmount}`)
  }

  if (opts.accountAgeDays < 7) {
    flags.push(`new_account:${Math.floor(opts.accountAgeDays)}_days_old`)
  }

  return flags
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  NOT_RECEIVED: 'Item never arrived',
  NOT_AS_DESCRIBED: 'Not as described',
  DAMAGED: 'Arrived damaged',
  WRONG_ITEM: 'Wrong item sent',
  OTHER: 'Other issue',
}

export const DISPUTE_REASON_DESCRIPTIONS: Record<DisputeReason, string> = {
  NOT_RECEIVED:
    'The item was never delivered or tracking shows it was lost in transit.',
  NOT_AS_DESCRIBED:
    'The item is significantly different from the listing — wrong size, hidden damage, or missing parts.',
  DAMAGED:
    'The item arrived with damage that was not present in the listing.',
  WRONG_ITEM:
    'I received a completely different item than what I ordered.',
  OTHER:
    'Something else went wrong with my order.',
}

export const DISPUTE_REASON_GUARANTEE: Record<DisputeReason, { headline: string; sub: string; color: 'green' | 'blue' }> = {
  NOT_RECEIVED: {
    headline: 'Every dollar back — no return needed',
    sub: 'You\'ll get back every dollar you paid — item price and shipping. Guaranteed. No return required.',
    color: 'green',
  },
  NOT_AS_DESCRIBED: {
    headline: 'Every dollar back — return required',
    sub: 'You\'ll get back every dollar you paid — item price and shipping. Guaranteed. Return the item with the free prepaid label we send you and your full refund will be on its way.',
    color: 'green',
  },
  DAMAGED: {
    headline: 'Every dollar back — return required',
    sub: 'You\'ll get back every dollar you paid — item price and shipping. Guaranteed. Return the item with the free prepaid label we send you and your full refund will be on its way.',
    color: 'green',
  },
  WRONG_ITEM: {
    headline: 'Every dollar back — return required',
    sub: 'You\'ll get back every dollar you paid — item price and shipping. Guaranteed. Return the item with the free prepaid label we send you and your full refund will be on its way.',
    color: 'green',
  },
  OTHER: {
    headline: 'Every dollar back — return required',
    sub: 'You\'ll get back every dollar you paid — item price and shipping. Guaranteed. Return the item with the free prepaid label we send you and your full refund will be on its way.',
    color: 'green',
  },
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Open',
  AWAITING_SELLER: 'Awaiting seller',
  AWAITING_BUYER: 'Awaiting buyer',
  RETURN_REQUESTED: 'Return requested',
  RETURN_SHIPPED: 'Return in transit',
  RETURN_RECEIVED: 'Return received',
  UNDER_REVIEW: 'Under review',
  RESOLVED_REFUND: 'Refund issued',
  RESOLVED_NO_REFUND: 'Closed — no refund',
  RESOLVED_KEEP_ITEM: 'Resolved — keep item',
  CLOSED: 'Closed',
}

export const DISPUTE_STATUS_COLORS: Record<DisputeStatus, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  AWAITING_SELLER: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  AWAITING_BUYER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  RETURN_REQUESTED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  RETURN_SHIPPED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  RETURN_RECEIVED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  RESOLVED_REFUND: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  RESOLVED_NO_REFUND: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  RESOLVED_KEEP_ITEM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CLOSED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
}

export const DISPUTE_RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  FULL_REFUND: 'Full refund (return item)',
  PARTIAL_REFUND: 'Partial refund (keep item)',
  REPLACEMENT: 'Replacement',
  FLAG_ONLY: 'Just flag it',
}

export const SURF_DAMAGE_TYPES = [
  'Pressure dings',
  'Delamination',
  'Fin box damage',
  'Snapped',
  'Rail damage',
  'Nose/tail damage',
  'Yellowing',
  'Other',
] as const

export type SurfDamageType = (typeof SURF_DAMAGE_TYPES)[number]

/** Returns true for resolved/closed statuses */
export function isDisputeResolved(status: DisputeStatus): boolean {
  return ['RESOLVED_REFUND', 'RESOLVED_NO_REFUND', 'RESOLVED_KEEP_ITEM', 'CLOSED'].includes(status)
}

/** Returns true if the dispute is in active return flow */
export function isInReturnFlow(status: DisputeStatus): boolean {
  return ['RETURN_REQUESTED', 'RETURN_SHIPPED', 'RETURN_RECEIVED'].includes(status)
}
