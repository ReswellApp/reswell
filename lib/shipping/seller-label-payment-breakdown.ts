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

/** Flat shipping: label is paid from buyer prepaid shipping; surplus credits seller wallet. */
export function computeSellerLabelPrepaidAllowanceBreakdown(input: {
  labelCostUsd: number
  buyerPrepaidAvailableUsd: number
}): SellerLabelPaymentBreakdown {
  const labelCostUsd = roundMoney(input.labelCostUsd)
  const buyerPrepaidAvailableUsd = roundMoney(Math.max(0, input.buyerPrepaidAvailableUsd))
  const excessOverPrepaidUsd = roundMoney(Math.max(0, labelCostUsd - buyerPrepaidAvailableUsd))
  const canPurchaseWithPrepaidAllowance =
    labelCostUsd >= 0.5 && excessOverPrepaidUsd <= 0
  const buyerPrepaidAppliedUsd = canPurchaseWithPrepaidAllowance ? labelCostUsd : 0
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

/** Card checkout: charge the full label cost on card when it exceeds buyer prepaid shipping. */
export function computeSellerLabelCardPaymentBreakdown(input: {
  labelCostUsd: number
}): Pick<SellerLabelPaymentBreakdown, "labelCostUsd" | "cardChargeUsd"> {
  const labelCostUsd = roundMoney(input.labelCostUsd)
  return {
    labelCostUsd,
    cardChargeUsd: labelCostUsd,
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
