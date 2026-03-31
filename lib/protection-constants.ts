/**
 * Reswell Purchase Protection — constants and core business logic.
 *
 * These are the single source of truth for all fee rates and coverage caps.
 * Never hardcode raw numbers elsewhere in the codebase.
 */

/** Reswell marketplace fee: 7% of sale price — buyer protection is funded from this fee */
export const RESWELL_FEE = 0.07

/** Stripe processing rate (card payments only) */
export const STRIPE_PROCESSING_RATE = 0.029
/** Stripe processing fixed fee in USD (card payments only) */
export const STRIPE_PROCESSING_FIXED = 0.30

/**
 * Minimum Reswell operating reserve (USD) — used for internal monitoring only.
 * No longer tied to a seller-funded pool; buyer protection is funded from the 7% platform fee.
 */
export const PROTECTION_FUND_MINIMUM_RESERVE = 500

/** Protection window duration in days (from delivery confirmation) */
export const PROTECTION_WINDOW_DAYS = 30

/** Hours after delivery confirmation that triggers a fraud flag */
export const FRAUD_FLAG_QUICK_CLAIM_HOURS = 2

/** Max claims in 90 days before flagging for review */
export const FRAUD_FLAG_MAX_CLAIMS_90_DAYS = 3

/** Days a new account must be aged before claims are trusted without a flag */
export const FRAUD_FLAG_NEW_ACCOUNT_DAYS = 7

/** Max evidence files per claim */
export const MAX_EVIDENCE_FILES = 8

/** Minimum description length for a claim */
export const MIN_DESCRIPTION_CHARS = 80

/** Seller response window in hours */
export const SELLER_RESPONSE_WINDOW_HOURS = 48

/** Seller appeal window in days */
export const SELLER_APPEAL_WINDOW_DAYS = 7

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ClaimType = 'NOT_RECEIVED' | 'NOT_AS_DESCRIBED' | 'DAMAGED' | 'UNAUTHORIZED'
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'PAID_OUT' | 'WITHDRAWN'
export type PayoutMethod = 'ORIGINAL_PAYMENT' | 'RESWELL_CREDIT' | 'BANK_TRANSFER'

export type ProtectionClaim = {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  claim_type: ClaimType
  status: ClaimStatus
  description: string
  claimed_amount: number
  approved_amount: number | null
  payout_method: PayoutMethod | null
  denial_reason: string | null
  evidence_urls: string[]
  fraud_flags: string[]
  seller_response: string | null
  seller_responded_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  paid_at: string | null
  created_at: string
}

export type ProtectionEligibility = {
  id: string
  order_id: string
  is_eligible: boolean
  reason: string | null
  window_closes: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Core business logic
// ─────────────────────────────────────────────────────────────

/**
 * Calculate seller payout breakdown.
 * Reswell takes 7%. Seller keeps 93%. No protection fund deduction.
 * Buyer protection is funded entirely from Reswell's 7% platform fee.
 *
 * @param cardPayment - If true, also calculates Stripe processing fee (2.9% + $0.30).
 *   Note: Stripe processing is charged separately and does not reduce seller payout directly
 *   when using Stripe Connect — it is deducted from the platform's application fee share.
 *   // TODO: Confirm whether Stripe processing fee is passed to buyer or absorbed by Reswell
 */
export function getProtectedSellerPayout(saleTotal: number, cardPayment = false): {
  saleTotal: number
  reswellFee: number
  stripeProcessingFee: number
  sellerPayout: number
} {
  const reswellFee = Math.round(saleTotal * RESWELL_FEE * 100) / 100
  const stripeProcessingFee = cardPayment
    ? Math.round((saleTotal * STRIPE_PROCESSING_RATE + STRIPE_PROCESSING_FIXED) * 100) / 100
    : 0
  const sellerPayout = Math.round((saleTotal - reswellFee) * 100) / 100
  return { saleTotal, reswellFee, stripeProcessingFee, sellerPayout }
}

/**
 * Calculate the approved payout amount for a claim.
 * Full refund — every dollar the customer paid — for all claim types.
 * No cap per Reswell guarantee policy.
 */
export function calculateApprovedAmount(
  _claimType: ClaimType,
  _claimedAmount: number,
  orderItemPrice: number,
  orderShippingCost: number
): number {
  // Full refund — every dollar the customer paid
  // No cap per Reswell guarantee policy
  return Math.round((orderItemPrice + orderShippingCost) * 100) / 100
}

/**
 * Check if a protection window is still active (not expired).
 */
export function isProtectionWindowActive(windowCloses: string | Date): boolean {
  return new Date(windowCloses) > new Date()
}

/**
 * Calculate days remaining in protection window.
 */
export function daysRemainingInWindow(windowCloses: string | Date): number {
  const ms = new Date(windowCloses).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Return protection window close date (30 days after delivery confirmation).
 */
export function getProtectionWindowClose(deliveryConfirmedAt: string | Date): Date {
  const d = new Date(deliveryConfirmedAt)
  d.setDate(d.getDate() + PROTECTION_WINDOW_DAYS)
  return d
}

/**
 * Fraud detection: returns an array of flag reasons (stored silently).
 * Never exposed to buyer or seller.
 */
export function detectFraudFlags(opts: {
  recentClaimCount: number
  accountCreatedAt: string | Date
  deliveryConfirmedAt: string | Date | null
  claimedAmount: number
  orderAmount: number
  sellerDisputeCount: number
}): string[] {
  const flags: string[] = []

  if (opts.recentClaimCount >= FRAUD_FLAG_MAX_CLAIMS_90_DAYS) {
    flags.push(`buyer_high_claim_frequency:${opts.recentClaimCount}_in_90d`)
  }

  const accountAgeDays =
    (Date.now() - new Date(opts.accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (accountAgeDays < FRAUD_FLAG_NEW_ACCOUNT_DAYS) {
    flags.push(`new_account:${Math.floor(accountAgeDays)}_days_old`)
  }

  if (opts.deliveryConfirmedAt) {
    const hoursAfterDelivery =
      (Date.now() - new Date(opts.deliveryConfirmedAt).getTime()) / (1000 * 60 * 60)
    if (hoursAfterDelivery < FRAUD_FLAG_QUICK_CLAIM_HOURS) {
      flags.push(`quick_claim:${hoursAfterDelivery.toFixed(1)}h_after_delivery`)
    }
  }

  if (opts.claimedAmount > opts.orderAmount) {
    flags.push(`claimed_exceeds_order:${opts.claimedAmount}_vs_${opts.orderAmount}`)
  }

  if (opts.sellerDisputeCount === 0) {
    flags.push('seller_zero_disputes:highly_trusted')
  }

  return flags
}

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  NOT_RECEIVED: 'Item never arrived',
  NOT_AS_DESCRIBED: 'Item not as described',
  DAMAGED: 'Item arrived damaged',
  UNAUTHORIZED: 'Unauthorized transaction',
}

export const CLAIM_TYPE_DESCRIPTIONS: Record<ClaimType, string> = {
  NOT_RECEIVED: 'I never received the item or it shows as undelivered.',
  NOT_AS_DESCRIBED:
    'The item is significantly different from the listing — wrong size, hidden damage, or missing parts.',
  DAMAGED: 'The item arrived damaged due to shipping.',
  UNAUTHORIZED: 'I did not authorize this transaction.',
}

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: 'Under Review',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  PAID_OUT: 'Paid',
  WITHDRAWN: 'Withdrawn',
}

export const CLAIM_STATUS_COLORS: Record<ClaimStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DENIED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  PAID_OUT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  WITHDRAWN: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
}
