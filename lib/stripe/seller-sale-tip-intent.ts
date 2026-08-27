export const SELLER_SALE_TIP_PI_PURPOSE = "seller_sale_tip"

export type SellerSaleTipPaymentIntentCreateParams = {
  amount: number
  currency: "usd"
  automatic_payment_methods: { enabled: true; allow_redirects: "never" }
  receipt_email?: string
  metadata: {
    purpose: typeof SELLER_SALE_TIP_PI_PURPOSE
    listing_id: string
    seller_id: string
    amount_cents: string
  }
  description: string
}

/**
 * Platform-account charge for a mark-as-sold tip. Must never include
 * `transfer_data`, `on_behalf_of`, or `application_fee_amount` — those would
 * send funds to the seller's Connect account / earnings.
 */
export function buildSellerSaleTipPaymentIntentCreateParams(input: {
  amountCents: number
  listingId: string
  sellerUserId: string
  listingTitle: string
  sellerEmail?: string | null
}): SellerSaleTipPaymentIntentCreateParams {
  const receiptEmail = input.sellerEmail?.trim() || undefined
  return {
    amount: input.amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
    metadata: {
      purpose: SELLER_SALE_TIP_PI_PURPOSE,
      listing_id: input.listingId,
      seller_id: input.sellerUserId,
      amount_cents: String(input.amountCents),
    },
    description: `Reswell tip — ${input.listingTitle}`.slice(0, 1000),
  }
}

export function sellerSaleTipCreateParamsKeepFundsOnPlatform(
  params: SellerSaleTipPaymentIntentCreateParams,
): boolean {
  const record = params as Record<string, unknown>
  return (
    record.transfer_data == null &&
    record.on_behalf_of == null &&
    record.application_fee_amount == null &&
    params.metadata.purpose === SELLER_SALE_TIP_PI_PURPOSE &&
    !("buyer_id" in params.metadata)
  )
}

export function isSellerSaleTipPaymentIntent(pi: {
  metadata?: { purpose?: string | null } | null
}): boolean {
  return pi.metadata?.purpose === SELLER_SALE_TIP_PI_PURPOSE
}

/** True if Stripe would move the tip off the platform (seller Connect / destination). */
export function sellerSaleTipPaymentIntentRoutesToSeller(pi: {
  transfer_data?: { destination?: string | null } | null
  on_behalf_of?: string | null
}): boolean {
  return Boolean(pi.transfer_data?.destination || pi.on_behalf_of)
}
