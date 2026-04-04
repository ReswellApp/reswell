import { publicSiteOrigin } from '@/lib/public-site-origin'

/**
 * Reswell Dispute Resolution — email notification templates.
 * Returns { subject, text } — wire to your email provider as needed.
 */

function usd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller: dispute opened
// ─────────────────────────────────────────────────────────────────────────────

export function disputeOpenedSellerEmail(opts: {
  sellerName: string
  buyerName: string
  listingTitle: string
  disputeId: string
  orderId: string
  reason: string
  description: string
  deadlineAt: Date
}): { subject: string; text: string } {
  const deadlineStr = opts.deadlineAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return {
    subject: `A buyer opened a dispute on "${opts.listingTitle}"`,
    text: `Hi ${opts.sellerName},

${opts.buyerName} has opened a dispute on order #${opts.orderId.slice(0, 8).toUpperCase()}.

Listing:  ${opts.listingTitle}
Issue:    ${opts.reason}
Details:  "${opts.description.slice(0, 200)}${opts.description.length > 200 ? '...' : ''}"

You have until ${deadlineStr} (48 hours) to respond.

How to respond:
  • Accept and request item return → free prepaid label is generated for the buyer
  • Propose a partial refund → buyer can accept or reject
  • Dispute the claim → submit counter-evidence and enter negotiation

Respond now:
${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

If you do not respond within 48 hours, the dispute will be escalated to our team.

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer: return label sent
// ─────────────────────────────────────────────────────────────────────────────

export function disputeReturnLabelEmail(opts: {
  buyerName: string
  listingTitle: string
  disputeId: string
  labelUrl: string
  isLargeItem: boolean
  deadlineDays: number
}): { subject: string; text: string } {
  const largeItemNote = opts.isLargeItem
    ? `\nNote: Due to the size of this item, we'll arrange a freight pickup at no cost to you. Our team will contact you within 24 hours to schedule.\n`
    : ''

  return {
    subject: `Your return label is ready — ship within ${opts.deadlineDays} days`,
    text: `Hi ${opts.buyerName},

Your return label for "${opts.listingTitle}" is ready.

IMPORTANT: You must ship the item within ${opts.deadlineDays} calendar days or the dispute will be closed in the seller's favor and no refund will be issued.
${largeItemNote}
Download your free prepaid return label:
${opts.labelUrl}

Steps:
  1. Pack the item carefully in its original packaging if possible
  2. Affix the label to the outside of the package
  3. Drop off at any carrier location
  4. Enter your tracking number in the dispute page:
     ${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

Your refund will be released after the seller confirms receipt of the item.

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer: return window warning (1 day left)
// ─────────────────────────────────────────────────────────────────────────────

export function disputeReturnWindowWarningEmail(opts: {
  buyerName: string
  listingTitle: string
  disputeId: string
  labelUrl: string
}): { subject: string; text: string } {
  return {
    subject: `Action required: 1 day left to ship your return for "${opts.listingTitle}"`,
    text: `Hi ${opts.buyerName},

You have 1 day left to ship your return for "${opts.listingTitle}".

If you do not ship the item by tomorrow, the dispute will close in the seller's favor and no refund will be issued.

Download return label: ${opts.labelUrl}

Enter tracking number after shipping:
${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer + Seller: return window expired
// ─────────────────────────────────────────────────────────────────────────────

export function disputeReturnWindowExpiredEmail(opts: {
  recipientName: string
  listingTitle: string
  disputeId: string
  role: 'buyer' | 'seller'
}): { subject: string; text: string } {
  const buyerText = `The return window for "${opts.listingTitle}" has expired. Your dispute has been closed in the seller's favor — no refund will be issued.

If you believe this is an error, please contact our support team.`

  const sellerText = `The buyer did not ship the return for "${opts.listingTitle}" within the required window. The dispute has been closed in your favor — your funds are released.`

  return {
    subject: `Dispute closed — return window expired for "${opts.listingTitle}"`,
    text: `Hi ${opts.recipientName},

${opts.role === 'buyer' ? buyerText : sellerText}

Dispute reference: ${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller: buyer has shipped item back
// ─────────────────────────────────────────────────────────────────────────────

export function disputeReturnShippedSellerEmail(opts: {
  sellerName: string
  listingTitle: string
  disputeId: string
  trackingNumber: string
  estimatedDelivery?: string
}): { subject: string; text: string } {
  const deliveryLine = opts.estimatedDelivery
    ? `Estimated delivery: ${opts.estimatedDelivery}\n`
    : ''

  return {
    subject: `Return shipped — "${opts.listingTitle}" is on its way back`,
    text: `Hi ${opts.sellerName},

The buyer has shipped the item back for "${opts.listingTitle}".

Tracking number: ${opts.trackingNumber}
${deliveryLine}
When the item arrives, confirm receipt in your dashboard. You'll have two options:
  • "Item received — condition acceptable" → releases the refund to the buyer
  • "Item received — condition issue" → escalates to our team with your photos

Confirm receipt:
${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

IMPORTANT: If you do not confirm within 3 days of delivery, the refund will be automatically released to the buyer using tracking proof.

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller: please confirm return receipt
// ─────────────────────────────────────────────────────────────────────────────

export function disputeConfirmReturnEmail(opts: {
  sellerName: string
  listingTitle: string
  disputeId: string
  daysBeforeAutoRelease: number
}): { subject: string; text: string } {
  return {
    subject: `Has the return arrived? Confirm receipt for "${opts.listingTitle}"`,
    text: `Hi ${opts.sellerName},

Tracking indicates the return for "${opts.listingTitle}" has been delivered.

Please confirm receipt in your dashboard within ${opts.daysBeforeAutoRelease} days.

  • "Item received — condition acceptable" → releases refund to buyer
  • "Item received — condition issue" → escalates to our team

Confirm now:
${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

If you do not confirm within ${opts.daysBeforeAutoRelease} days, the refund will be automatically released to the buyer.

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer: refund released
// ─────────────────────────────────────────────────────────────────────────────

export function disputeRefundReleasedEmail(opts: {
  buyerName: string
  listingTitle: string
  disputeId: string
  refundAmount: number
  reason: string
  isNotReceived: boolean
}): { subject: string; text: string } {
  const notReceivedNote = opts.isNotReceived
    ? `\nYour full refund covers the item price + shipping, as guaranteed by our policy.\nNo return was required.\n`
    : ''

  return {
    subject: `Your refund of ${usd(opts.refundAmount)} is on the way`,
    text: `Hi ${opts.buyerName},

Great news — your dispute on "${opts.listingTitle}" has been resolved.

Refund amount: ${usd(opts.refundAmount)}
${notReceivedNote}
Your refund will appear on your original payment method within 3–5 business days.

Dispute reference: ${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

Thank you for your patience through this process.

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller: dispute resolved (funds released / closed in their favor)
// ─────────────────────────────────────────────────────────────────────────────

export function disputeResolvedSellerEmail(opts: {
  sellerName: string
  listingTitle: string
  disputeId: string
  outcome: 'REFUND_ISSUED' | 'CLOSED_YOUR_FAVOR' | 'PARTIAL_AGREED'
  refundAmount?: number
}): { subject: string; text: string } {
  const outcomeText = {
    REFUND_ISSUED: `The dispute has been resolved with a refund of ${usd(opts.refundAmount ?? 0)} issued to the buyer. The item has been returned to you.`,
    CLOSED_YOUR_FAVOR: `The dispute on "${opts.listingTitle}" has been closed in your favor. Your funds are released.`,
    PARTIAL_AGREED: `Both parties agreed to a partial refund of ${usd(opts.refundAmount ?? 0)}. The item remains with the buyer.`,
  }[opts.outcome]

  return {
    subject: `Dispute resolved — "${opts.listingTitle}"`,
    text: `Hi ${opts.sellerName},

${outcomeText}

View dispute:
${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer/Seller: dispute escalated to admin
// ─────────────────────────────────────────────────────────────────────────────

export function disputeEscalatedEmail(opts: {
  recipientName: string
  listingTitle: string
  disputeId: string
  role: 'buyer' | 'seller'
}): { subject: string; text: string } {
  return {
    subject: `Dispute escalated to Reswell team — "${opts.listingTitle}"`,
    text: `Hi ${opts.recipientName},

The dispute on "${opts.listingTitle}" has been escalated to the Reswell team for review.

Our team will review all messages, evidence, and order details and issue a final decision. You will be notified when a resolution has been reached.

Our target resolution time is 2–3 business days.

Dispute reference: ${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buyer: seller proposed partial refund
// ─────────────────────────────────────────────────────────────────────────────

export function disputePartialProposalEmail(opts: {
  buyerName: string
  listingTitle: string
  disputeId: string
  partialAmount: number
}): { subject: string; text: string } {
  return {
    subject: `Seller proposed a partial refund of ${usd(opts.partialAmount)} on "${opts.listingTitle}"`,
    text: `Hi ${opts.buyerName},

The seller has proposed a partial refund of ${usd(opts.partialAmount)} to resolve the dispute on "${opts.listingTitle}". You would keep the item.

You can:
  • Accept the partial refund → no return needed, refund issued immediately
  • Reject → continue negotiation or escalate to our team

Respond now:
${publicSiteOrigin()}/dashboard/disputes/${opts.disputeId}

— The Reswell Team`,
  }
}
