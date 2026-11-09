/**
 * Integer-cent journal for an admin Reswell Bucks checkout.
 * Buyer spend + promo subsidy = seller pending + marketplace fee + shipping clearing.
 */

export class ReswellBucksSettlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReswellBucksSettlementError"
  }
}

export type ReswellBucksAccountCode =
  | "buyer_available"
  | "seller_pending"
  | "platform_fee"
  | "shipping_clearing"
  | "promo_subsidy"

export type ReswellBucksLeg = {
  accountCode: ReswellBucksAccountCode
  direction: "debit" | "credit"
  amountCents: number
}

export type ReswellBucksLineCents = {
  listingId: string
  quantity: 1
  itemPriceCents: number
  shippingCents: number
  platformFeeCents: number
  sellerEarningsCents: number
}

export type ReswellBucksSettlement = {
  amountCents: number
  shippingCents: number
  platformFeeCents: number
  sellerEarningsCents: number
  promoDiscountCents: number
  lines: ReswellBucksLineCents[]
  legs: ReswellBucksLeg[]
}

export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd)) {
    throw new ReswellBucksSettlementError("invalid_amount")
  }
  return Math.round(usd * 100)
}

function pushLeg(
  legs: ReswellBucksLeg[],
  accountCode: ReswellBucksAccountCode,
  direction: "debit" | "credit",
  amountCents: number,
): void {
  if (amountCents > 0) {
    legs.push({ accountCode, direction, amountCents })
  }
}

export function lineCentsFromCheckoutLine(line: {
  listingId: string
  quantity: number
  itemPrice: number
  shippingUsd: number
  platformFee: number
  sellerEarnings: number
}): ReswellBucksLineCents {
  if (line.quantity !== 1) {
    throw new ReswellBucksSettlementError("invalid_amount")
  }
  const itemPriceCents = usdToCents(line.itemPrice)
  const shippingCents = usdToCents(line.shippingUsd)
  const platformFeeCents = usdToCents(line.platformFee)
  const sellerEarningsCents = usdToCents(line.sellerEarnings)
  if (
    itemPriceCents < 0 ||
    shippingCents < 0 ||
    platformFeeCents < 0 ||
    sellerEarningsCents < 0 ||
    itemPriceCents !== platformFeeCents + sellerEarningsCents
  ) {
    throw new ReswellBucksSettlementError("unbalanced_line")
  }
  return {
    listingId: line.listingId,
    quantity: 1,
    itemPriceCents,
    shippingCents,
    platformFeeCents,
    sellerEarningsCents,
  }
}

/**
 * Builds the journal from checkout lines. `chargedUsd` must already be the buyer total
 * (item + shipping − promo). A one-cent drift fails closed.
 */
export function buildReswellBucksSettlement(params: {
  lines: ReadonlyArray<{
    listingId: string
    quantity: number
    itemPrice: number
    shippingUsd: number
    platformFee: number
    sellerEarnings: number
  }>
  promoDiscountUsd: number
  chargedUsd: number
}): ReswellBucksSettlement {
  if (params.lines.length === 0) {
    throw new ReswellBucksSettlementError("invalid_amount")
  }

  const lines = params.lines.map(lineCentsFromCheckoutLine)
  const sellerEarningsCents = lines.reduce((sum, line) => sum + line.sellerEarningsCents, 0)
  const platformFeeCents = lines.reduce((sum, line) => sum + line.platformFeeCents, 0)
  const shippingCents = lines.reduce((sum, line) => sum + line.shippingCents, 0)
  const promoDiscountCents = usdToCents(params.promoDiscountUsd)
  const amountCents = usdToCents(params.chargedUsd)

  if (
    promoDiscountCents < 0 ||
    amountCents < 0 ||
    sellerEarningsCents <= 0 ||
    amountCents + promoDiscountCents !== sellerEarningsCents + platformFeeCents + shippingCents
  ) {
    throw new ReswellBucksSettlementError("unbalanced_settlement")
  }

  const legs: ReswellBucksLeg[] = []
  pushLeg(legs, "buyer_available", "debit", amountCents)
  pushLeg(legs, "promo_subsidy", "debit", promoDiscountCents)
  pushLeg(legs, "seller_pending", "credit", sellerEarningsCents)
  pushLeg(legs, "platform_fee", "credit", platformFeeCents)
  pushLeg(legs, "shipping_clearing", "credit", shippingCents)

  let debits = 0
  let credits = 0
  for (const leg of legs) {
    if (leg.direction === "debit") debits += leg.amountCents
    else credits += leg.amountCents
  }
  if (debits !== credits || legs.length < 2) {
    throw new ReswellBucksSettlementError("unbalanced_settlement")
  }

  return {
    amountCents,
    shippingCents,
    platformFeeCents,
    sellerEarningsCents,
    promoDiscountCents,
    lines,
    legs,
  }
}
