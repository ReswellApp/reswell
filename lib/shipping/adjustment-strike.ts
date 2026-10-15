import { HOW_TO_SHIP_HREF } from "@/lib/seller-resources"
import { formatAdjustmentUsd } from "@/lib/shipping/adjustment-fee"

export const SHIPPING_ADJUSTMENT_LEARN_MORE_HREF = `${HOW_TO_SHIP_HREF}#adjustments`

export type ShippingAdjustmentCoverage = "covered_strike" | "charged_to_earnings"

export type SellerCoveredShippingAdjustment = {
  id: string
  amountUsd: number
  lengthIn: number | null
  widthIn: number | null
  heightIn: number | null
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Amount taken off this sale's earnings. Never more than the sale earned. */
export function shippingAdjustmentEarningsDeduction(
  sellerEarningsUsd: number,
  adjustmentUsd: number,
): number {
  const earnings = roundMoney(Math.max(0, sellerEarningsUsd))
  const adjustment = roundMoney(Math.max(0, adjustmentUsd))
  return roundMoney(Math.min(earnings, adjustment))
}

/** Cash that can leave pending or available balance without going below zero. */
export function shippingAdjustmentWalletTake(availableUsd: number, deductionUsd: number): number {
  return roundMoney(Math.min(Math.max(0, availableUsd), Math.max(0, deductionUsd)))
}

export function coveredShippingAdjustmentMessage(amountUsd: number): string {
  const fee = formatAdjustmentUsd(amountUsd)
  return `The carrier adjusted this shipment and billed ${fee} more. Reswell is covering this one. The next adjustment on a shipped item will be deducted from your total earnings on that sale.`
}

export function shippingAdjustmentSellerCopy(input: {
  coverage: ShippingAdjustmentCoverage
  amountUsd: number
  earningsDeductedUsd: number
  listingTitle: string
}): { headline: string; message: string } {
  const title = input.listingTitle.trim() || "your item"
  const billed = formatAdjustmentUsd(input.amountUsd)
  if (input.coverage === "covered_strike") {
    return {
      headline: "Reswell covered this carrier adjustment",
      message: `The carrier adjusted the shipment for ${title} and billed ${billed} more. Reswell is covering this one. The next adjustment on a shipped item will be deducted from your total earnings on that sale. Pack the next box to the label size so the carrier's measurement matches what you entered.`,
    }
  }
  const deducted = formatAdjustmentUsd(input.earningsDeductedUsd)
  return {
    headline: "A carrier adjustment came out of this sale",
    message:
      input.earningsDeductedUsd > 0
        ? `The carrier adjusted the shipment for ${title}. ${deducted} was deducted from your earnings on this sale. Measure the packed box before the next drop-off and keep every side at or under the label.`
        : `The carrier adjusted the shipment for ${title} and billed ${billed} more. This sale did not have earnings left to deduct. Measure the packed box before the next drop-off and keep every side at or under the label.`,
  }
}
