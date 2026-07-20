import { roundMoney } from "@/lib/utils/stripe-connect-cashout"

export type SellerLabelPaymentBreakdown = {
  labelCostUsd: number
  /** Buyer prepaid flat shipping on the order. */
  buyerPrepaidAvailableUsd: number
  /** Label cost funded from buyer prepaid shipping (flat-rate allowance). */
  buyerPrepaidAppliedUsd: number
  /** Unused buyer prepaid shipping credited to seller wallet after label purchase. */
  shippingSurplusCreditUsd: number
  /** @deprecated Wallet debit for label — flat shipping uses prepaid allowance instead. */
  walletAppliedUsd: number
  cardChargeUsd: number
  canPurchaseWithPrepaidAllowance: boolean
  excessOverPrepaidUsd: number
}

/**
 * Flat shipping: buyer prepaid credits the label first.
 * - Label ≤ prepaid → print with prepaid; surplus credits seller wallet.
 * - Label > prepaid → seller pays only the excess on card; prepaid covers the rest.
 */
export function computeSellerLabelPrepaidAllowanceBreakdown(input: {
  labelCostUsd: number
  buyerPrepaidAvailableUsd: number
}): SellerLabelPaymentBreakdown {
  const labelCostUsd = roundMoney(input.labelCostUsd)
  const buyerPrepaidAvailableUsd = roundMoney(Math.max(0, input.buyerPrepaidAvailableUsd))
  const buyerPrepaidAppliedUsd = roundMoney(Math.min(labelCostUsd, buyerPrepaidAvailableUsd))
  const excessOverPrepaidUsd = roundMoney(Math.max(0, labelCostUsd - buyerPrepaidAvailableUsd))
  const canPurchaseWithPrepaidAllowance =
    labelCostUsd >= 0.5 && excessOverPrepaidUsd <= 0
  const shippingSurplusCreditUsd = canPurchaseWithPrepaidAllowance
    ? roundMoney(buyerPrepaidAvailableUsd - labelCostUsd)
    : 0

  return {
    labelCostUsd,
    buyerPrepaidAvailableUsd,
    buyerPrepaidAppliedUsd,
    shippingSurplusCreditUsd,
    walletAppliedUsd: 0,
    cardChargeUsd: excessOverPrepaidUsd,
    canPurchaseWithPrepaidAllowance,
    excessOverPrepaidUsd,
  }
}

/** Card checkout: charge only the label cost not covered by buyer prepaid flat shipping. */
export function computeSellerLabelCardPaymentBreakdown(input: {
  labelCostUsd: number
  buyerPrepaidAvailableUsd?: number
}): Pick<
  SellerLabelPaymentBreakdown,
  "labelCostUsd" | "cardChargeUsd" | "buyerPrepaidAppliedUsd" | "buyerPrepaidAvailableUsd"
> {
  const breakdown = computeSellerLabelPrepaidAllowanceBreakdown({
    labelCostUsd: input.labelCostUsd,
    buyerPrepaidAvailableUsd: input.buyerPrepaidAvailableUsd ?? 0,
  })
  return {
    labelCostUsd: breakdown.labelCostUsd,
    buyerPrepaidAvailableUsd: breakdown.buyerPrepaidAvailableUsd,
    buyerPrepaidAppliedUsd: breakdown.buyerPrepaidAppliedUsd,
    cardChargeUsd: breakdown.cardChargeUsd,
  }
}

/** @deprecated Use computeSellerLabelPrepaidAllowanceBreakdown for flat shipping label purchases. */
export function computeSellerLabelPaymentBreakdown(input: {
  labelCostUsd: number
  buyerPrepaidAvailableUsd: number
  walletSpendableUsd: number
  applyWallet: boolean
}): SellerLabelPaymentBreakdown {
  if (!input.applyWallet) {
    return computeSellerLabelPrepaidAllowanceBreakdown({
      labelCostUsd: input.labelCostUsd,
      buyerPrepaidAvailableUsd: input.buyerPrepaidAvailableUsd,
    })
  }

  const labelCostUsd = roundMoney(input.labelCostUsd)
  const buyerPrepaidAvailableUsd = roundMoney(Math.max(0, input.buyerPrepaidAvailableUsd))
  const walletCapUsd = buyerPrepaidAvailableUsd
  const walletAppliedUsd = roundMoney(
    Math.min(labelCostUsd, walletCapUsd, Math.max(0, input.walletSpendableUsd)),
  )
  const cardChargeUsd = roundMoney(labelCostUsd - walletAppliedUsd)
  const excessOverPrepaidUsd = roundMoney(Math.max(0, labelCostUsd - buyerPrepaidAvailableUsd))

  return {
    labelCostUsd,
    buyerPrepaidAvailableUsd,
    buyerPrepaidAppliedUsd: walletAppliedUsd,
    shippingSurplusCreditUsd: 0,
    walletAppliedUsd,
    cardChargeUsd,
    canPurchaseWithPrepaidAllowance: false,
    excessOverPrepaidUsd,
  }
}
