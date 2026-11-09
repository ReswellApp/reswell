export const ADJUSTMENT_DISPUTE_CARRIERS = ["ups", "fedex", "usps"] as const

export type AdjustmentDisputeCarrier = (typeof ADJUSTMENT_DISPUTE_CARRIERS)[number]

export const ADJUSTMENT_DISPUTE_REASON_CODES = [
  "dimensions_match_label",
  "weight_match_label",
  "duplicate_charge",
  "wrong_package",
] as const

export type AdjustmentDisputeReasonCode = (typeof ADJUSTMENT_DISPUTE_REASON_CODES)[number]

export const ADJUSTMENT_DISPUTE_STATUSES = [
  "submitted_to_reswell",
  "submitted_to_carrier",
  "resolved",
  "denied",
] as const

export type AdjustmentDisputeStatus = (typeof ADJUSTMENT_DISPUTE_STATUSES)[number]

export function adjustmentCarrierLabel(carrier: AdjustmentDisputeCarrier): string {
  if (carrier === "ups") return "UPS"
  if (carrier === "fedex") return "FedEx"
  return "USPS"
}

export function inferAdjustmentCarrier(
  ...sources: Array<string | null | undefined>
): AdjustmentDisputeCarrier | null {
  const text = sources
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()
  if (!text) return null
  if (text.includes("fedex") || text.includes("fed ex")) return "fedex"
  if (text.includes("usps") || text.includes("stamps.com") || text.includes("endicia")) return "usps"
  if (text.includes("ups")) return "ups"
  return null
}

export function adjustmentDisputeReasonLabel(
  carrier: AdjustmentDisputeCarrier,
  reason: AdjustmentDisputeReasonCode,
): string {
  const name = adjustmentCarrierLabel(carrier)
  switch (reason) {
    case "dimensions_match_label":
      return `Packed size matched the ${name} label`
    case "weight_match_label":
      return `Packed weight matched the ${name} label`
    case "duplicate_charge":
      return `${name} billed this adjustment more than once`
    case "wrong_package":
      return `${name} measured a different package`
  }
}

export function adjustmentDisputeStatusLabel(status: AdjustmentDisputeStatus): string {
  switch (status) {
    case "submitted_to_reswell":
      return "With Reswell"
    case "submitted_to_carrier":
      return "Submitted to carrier"
    case "resolved":
      return "Resolved"
    case "denied":
      return "Denied"
  }
}

export type SellerAdjustmentFeeDisputeView = {
  carrier: AdjustmentDisputeCarrier
  status: AdjustmentDisputeStatus
  sellerStatement: string
  reswellNote: string | null
  carrierReference: string | null
}

export type SellerAdjustmentFeeView = {
  id: string
  amountUsd: number
  debitedAt: string
  lengthIn: number | null
  widthIn: number | null
  heightIn: number | null
  weightLb: number | null
  suggestedCarrier: AdjustmentDisputeCarrier | null
  dispute: SellerAdjustmentFeeDisputeView | null
}

export function formatAdjustmentUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function sellerAdjustmentFeeExplanation(params: {
  amountUsd: number
  buyerShippingUsd: number
  lengthIn: number | null
  widthIn: number | null
  heightIn: number | null
}): string {
  const fee = formatAdjustmentUsd(params.amountUsd)
  const paid = formatAdjustmentUsd(params.buyerShippingUsd)
  const measured =
    params.lengthIn != null || params.widthIn != null || params.heightIn != null
      ? ` The carrier measured the packed package at ${[params.lengthIn, params.widthIn, params.heightIn]
          .map((value) => (value == null ? "—" : String(value)))
          .join(" × ")} in.`
      : " The carrier billed this because the packed package was larger or heavier than the label."
  return `Adjustment fee of ${fee}. The buyer paid ${paid} for the original label. This extra amount was deducted from your balance.${measured} Your sale earnings stay the sale amount. This line is the fee that left your balance.`
}
