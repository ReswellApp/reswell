/**
 * Reswell Purchase Protection — email notification templates.
 *
 * These return plain-text bodies + subject lines.
 * Wire into your email provider (Supabase trigger, Resend, etc.) as needed.
 */

import type { ClaimType } from '@/lib/protection-constants'

function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─────────────────────────────────────────────────────────────
// Buyer emails
// ─────────────────────────────────────────────────────────────

export function buyerClaimReceivedEmail(opts: {
  buyerName: string
  claimId: string
  claimType: ClaimType
  claimedAmount: number
  orderShortId: string
}): { subject: string; text: string } {
  const claimTypeLabel: Record<ClaimType, string> = {
    NOT_RECEIVED: 'Item never arrived',
    NOT_AS_DESCRIBED: 'Item not as described',
    DAMAGED: 'Item arrived damaged',
    UNAUTHORIZED: 'Unauthorized transaction',
  }

  return {
    subject: 'Your Reswell protection claim has been received',
    text: `Hi ${opts.buyerName},

We've received your protection claim for order #${opts.orderShortId}.

Claim details:
  Type: ${claimTypeLabel[opts.claimType]}
  Amount claimed: ${formatUSD(opts.claimedAmount)}
  Claim reference: ${opts.claimId.slice(0, 8).toUpperCase()}

What happens next:
  1. We've notified the seller and given them 48 hours to respond.
  2. Our team will review all evidence within 3 business days.
  3. You'll receive an email once a decision is made.

You can track your claim status at:
  https://reswell.com/dashboard/claims/${opts.claimId}

If you have additional evidence to add, reply to this email or
upload it directly from your claims dashboard.

— The Reswell Team`,
  }
}

export function buyerClaimApprovedNotReceivedEmail(opts: {
  buyerName: string
  claimId: string
  refundAmount: number
  orderShortId: string
  payoutMethod: string
}): { subject: string; text: string } {
  const methodLabel =
    opts.payoutMethod === 'ORIGINAL_PAYMENT'
      ? 'your original payment method (3–5 business days)'
      : opts.payoutMethod === 'RESWELL_CREDIT'
        ? 'your Reswell Bucks balance (immediately)'
        : 'your bank account (3–5 business days)'

  return {
    subject: 'Your claim is approved — full refund on the way',
    text: `Hi ${opts.buyerName},

Great news — your protection claim for order #${opts.orderShortId} has been approved.

Because your item never arrived, we're refunding your full payment
of ${formatUSD(opts.refundAmount)} including shipping.

Refund details:
  Amount: ${formatUSD(opts.refundAmount)}
  Sent to: ${methodLabel}

This is a full, no-questions-asked refund under Reswell's 100%
guarantee for undelivered items. No cap. No deductions.

View your claim: https://reswell.com/dashboard/claims/${opts.claimId}

— The Reswell Team`,
  }
}

export function buyerClaimApprovedOtherEmail(opts: {
  buyerName: string
  claimId: string
  approvedAmount: number
  claimType: ClaimType
  orderShortId: string
  payoutMethod: string
}): { subject: string; text: string } {
  const methodLabel =
    opts.payoutMethod === 'ORIGINAL_PAYMENT'
      ? 'your original payment method (3–5 business days)'
      : opts.payoutMethod === 'RESWELL_CREDIT'
        ? 'your Reswell Bucks balance (immediately)'
        : 'your bank account (3–5 business days)'

  return {
    subject: 'Your claim is approved — refund on the way',
    text: `Hi ${opts.buyerName},

Your protection claim for order #${opts.orderShortId} has been approved.

Refund details:
  Approved amount: ${formatUSD(opts.approvedAmount)}
  Sent to: ${methodLabel}

Note: Our protection policy covers up to $500 for this claim type.

View your claim: https://reswell.com/dashboard/claims/${opts.claimId}

— The Reswell Team`,
  }
}

export function buyerClaimDeniedEmail(opts: {
  buyerName: string
  claimId: string
  orderShortId: string
  denialReason: string
}): { subject: string; text: string } {
  return {
    subject: 'Update on your Reswell protection claim',
    text: `Hi ${opts.buyerName},

We've reviewed your protection claim for order #${opts.orderShortId}
and unfortunately we're unable to approve it at this time.

Reason:
  ${opts.denialReason}

Not happy with this decision?
You have one opportunity to appeal. Reply to this email with
any additional evidence within 7 days and our team will
take a second look.

You can also contact our support team directly at:
  https://reswell.com/contact

View your claim: https://reswell.com/dashboard/claims/${opts.claimId}

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────
// Seller emails
// ─────────────────────────────────────────────────────────────

export function sellerClaimFiledEmail(opts: {
  sellerName: string
  claimId: string
  orderShortId: string
  claimType: ClaimType
  claimedAmount: number
}): { subject: string; text: string } {
  const claimTypeLabel: Record<ClaimType, string> = {
    NOT_RECEIVED: 'item never arrived',
    NOT_AS_DESCRIBED: 'item not as described',
    DAMAGED: 'item arrived damaged',
    UNAUTHORIZED: 'unauthorized transaction',
  }

  return {
    subject: `A buyer has filed a protection claim on order #${opts.orderShortId}`,
    text: `Hi ${opts.sellerName},

A buyer has filed a Reswell Purchase Protection claim on one of your orders.

Claim details:
  Order: #${opts.orderShortId}
  Type: ${claimTypeLabel[opts.claimType]}
  Amount claimed: ${formatUSD(opts.claimedAmount)}

What you should do:
  You have 48 hours to respond. Go to your claims dashboard to:
  - Accept the claim (we'll process the refund)
  - Provide counter-evidence (photos, tracking, messages)
  - Mark as already resolved (if you've already refunded the buyer)

Respond here: https://reswell.com/dashboard/claims/${opts.claimId}

Ignoring this notice may result in the claim being automatically
approved in the buyer's favour.

— The Reswell Team`,
  }
}

export function sellerClaimResolvedEmail(opts: {
  sellerName: string
  claimId: string
  orderShortId: string
  outcome: 'APPROVED' | 'DENIED'
  approvedAmount?: number
}): { subject: string; text: string } {
  const outcomeText =
    opts.outcome === 'APPROVED'
      ? `The claim was approved and ${formatUSD(opts.approvedAmount ?? 0)} was refunded to the buyer from the Reswell Protection Fund. This amount was not deducted from your existing payout.`
      : 'The claim was denied. No funds were withheld or deducted from your payout.'

  return {
    subject: `Protection claim on order #${opts.orderShortId} has been resolved`,
    text: `Hi ${opts.sellerName},

The protection claim on order #${opts.orderShortId} has been resolved.

Outcome: ${opts.outcome}

${outcomeText}

View claim details: https://reswell.com/dashboard/claims/${opts.claimId}

Questions? Contact us at https://reswell.com/contact

— The Reswell Team`,
  }
}
