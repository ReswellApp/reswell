import { publicSiteOrigin } from '@/lib/public-site-origin'

/**
 * Reswell Offer & Negotiation — email notification templates.
 * Returns { subject, text } — wire to your email provider as needed.
 */

function usd(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function pct(amount: number, asking: number): string {
  return `${Math.round((amount / asking) * 100)}%`
}

// ─────────────────────────────────────────────────────────────
// Seller emails
// ─────────────────────────────────────────────────────────────

export function offerReceivedEmail(opts: {
  sellerName: string
  listingTitle: string
  offerId: string
  offerAmount: number
  askingPrice: number
  buyerNote: string | null
  expiresAt: Date
}): { subject: string; text: string } {
  const pctOfAsking = pct(opts.offerAmount, opts.askingPrice)
  const expiryStr = opts.expiresAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return {
    subject: `New offer on "${opts.listingTitle}" — ${usd(opts.offerAmount)}`,
    text: `Hi ${opts.sellerName},

You have a new offer on your listing!

Listing:     ${opts.listingTitle}
Asking price: ${usd(opts.askingPrice)}
Offer amount: ${usd(opts.offerAmount)} (${pctOfAsking} of asking)
${opts.buyerNote ? `Buyer's note: "${opts.buyerNote}"` : ''}
Expires:     ${expiryStr}

Respond to this offer within 48 hours:
${publicSiteOrigin()}/offers/${opts.offerId}

Options: Accept · Decline · Counter with a different price

— The Reswell Team`,
  }
}

// ─────────────────────────────────────────────────────────────
// Buyer emails
// ─────────────────────────────────────────────────────────────

export function offerCounteredEmail(opts: {
  buyerName: string
  listingTitle: string
  offerId: string
  counterAmount: number
  originalAmount: number
  askingPrice: number
  sellerNote: string | null
  expiresAt: Date
}): { subject: string; text: string } {
  const expiryStr = opts.expiresAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return {
    subject: `Seller countered your offer on "${opts.listingTitle}"`,
    text: `Hi ${opts.buyerName},

The seller has countered your offer!

Listing:         ${opts.listingTitle}
Your offer:      ${usd(opts.originalAmount)}
Seller counter:  ${usd(opts.counterAmount)} (${pct(opts.counterAmount, opts.askingPrice)} of asking)
${opts.sellerNote ? `Seller's note: "${opts.sellerNote}"` : ''}
Expires:         ${expiryStr}

Respond within 48 hours — this counter expires soon:
${publicSiteOrigin()}/offers/${opts.offerId}

Options: Accept the counter · Decline · Send your own counter

— The Reswell Team`,
  }
}

export function offerAcceptedEmail(opts: {
  buyerName: string
  listingTitle: string
  offerId: string
  listingSlug: string
  listingSection: string
  agreedAmount: number
  askingPrice: number
  paymentDeadline: Date
}): { subject: string; text: string } {
  const deadlineStr = opts.paymentDeadline.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const checkoutUrl = `${publicSiteOrigin()}/${opts.listingSection}/${opts.listingSlug}/checkout?offer_id=${opts.offerId}`

  return {
    subject: `Your offer was accepted! Complete your purchase on "${opts.listingTitle}"`,
    text: `Hi ${opts.buyerName},

Great news — your offer was accepted!

Listing:       ${opts.listingTitle}
Original price: ${usd(opts.askingPrice)}
Agreed price:  ${usd(opts.agreedAmount)}
You saved:     ${usd(opts.askingPrice - opts.agreedAmount)}

You have until ${deadlineStr} to complete your purchase.
After this deadline the offer expires and the listing returns to available.

Complete your purchase now:
${checkoutUrl}

This link goes directly to checkout with your agreed price pre-filled.

— The Reswell Team`,
  }
}

export function offerDeclinedEmail(opts: {
  buyerName: string
  listingTitle: string
  listingSection: string
  listingSlug: string
  offerId: string
  offeredAmount: number
  sellerNote: string | null
}): { subject: string; text: string } {
  const listingUrl = `${publicSiteOrigin()}/${opts.listingSection}/${opts.listingSlug}`

  return {
    subject: `Your offer on "${opts.listingTitle}" was declined`,
    text: `Hi ${opts.buyerName},

The seller has declined your offer of ${usd(opts.offeredAmount)} on "${opts.listingTitle}".
${opts.sellerNote ? `\nSeller's note: "${opts.sellerNote}"\n` : ''}
The listing is still available. You can make a new offer after a short cooldown:
${listingUrl}

— The Reswell Team`,
  }
}

export function offerExpiredEmail(opts: {
  recipientName: string
  listingTitle: string
  listingSection: string
  listingSlug: string
  offeredAmount: number
  role: 'buyer' | 'seller'
}): { subject: string; text: string } {
  const listingUrl = `${publicSiteOrigin()}/${opts.listingSection}/${opts.listingSlug}`

  const buyerText = `The offer of ${usd(opts.offeredAmount)} on "${opts.listingTitle}" has expired with no response.

The listing is still available. You can make a new offer here:
${listingUrl}`

  const sellerText = `The offer of ${usd(opts.offeredAmount)} on your listing "${opts.listingTitle}" expired without a response.

Your listing is fully available again. View your listing:
${listingUrl}`

  return {
    subject: `Offer on "${opts.listingTitle}" has expired`,
    text: `Hi ${opts.recipientName},

${opts.role === 'buyer' ? buyerText : sellerText}

— The Reswell Team`,
  }
}

export function offerExpiringEmail(opts: {
  recipientName: string
  listingTitle: string
  offerId: string
  currentAmount: number
  hoursLeft: number
  role: 'buyer' | 'seller'
}): { subject: string; text: string } {
  return {
    subject: `Offer on "${opts.listingTitle}" expires in ${opts.hoursLeft} hours`,
    text: `Hi ${opts.recipientName},

Your ${opts.role === 'buyer' ? 'offer' : "buyer's offer"} of ${usd(opts.currentAmount)} on "${opts.listingTitle}" expires in ${opts.hoursLeft} hours.

Don't miss out — respond now:
${publicSiteOrigin()}/offers/${opts.offerId}

— The Reswell Team`,
  }
}

export function paymentDeadlineWarningEmail(opts: {
  buyerName: string
  listingTitle: string
  offerId: string
  listingSlug: string
  listingSection: string
  agreedAmount: number
  hoursLeft: number
}): { subject: string; text: string } {
  const checkoutUrl = `${publicSiteOrigin()}/${opts.listingSection}/${opts.listingSlug}/checkout?offer_id=${opts.offerId}`

  return {
    subject: `${opts.hoursLeft} hours left to complete your purchase on "${opts.listingTitle}"`,
    text: `Hi ${opts.buyerName},

Reminder: you have ${opts.hoursLeft} hours to complete your purchase.

Your agreed price: ${usd(opts.agreedAmount)}
Listing: ${opts.listingTitle}

Complete checkout now (offer expires if you don't pay in time):
${checkoutUrl}

— The Reswell Team`,
  }
}
