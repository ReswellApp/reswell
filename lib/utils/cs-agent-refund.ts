export type CsAgentRefundOrder = {
  status: string
  amount: number
  paymentMethod?: string | null
  fulfillmentMethod?: string | null
  deliveryStatus?: string | null
  repairCreditTotal?: number
}

export type CsAgentRefundAssessment = {
  alreadyRefunded: boolean
  inProgress: boolean
  staffMayRefund: boolean
  /** Never tell the customer a refund is approved from this field. */
  customerFacing: string
  staffNote: string
}

function suggestedStaffPlan(order: CsAgentRefundOrder): string {
  const fulfillment = (order.fulfillmentMethod ?? "").trim().toLowerCase()
  const delivery = (order.deliveryStatus ?? "").trim().toLowerCase()
  if ((fulfillment === "pickup" || fulfillment === "local_pickup") && delivery !== "picked_up") {
    return "cancel_uncollected"
  }
  if (fulfillment === "shipping" && delivery === "pending") return "cancel_unshipped"
  return "staff review"
}

/**
 * Staff-only refund facts for the CS agent. Never authorizes a refund
 * and never invents a promise the customer can read as approval.
 */
export function assessCsAgentRefundEligibility(order: CsAgentRefundOrder): CsAgentRefundAssessment {
  const status = order.status.trim().toLowerCase()
  const alreadyRefunded = status === "refunded"
  const inProgress = status === "refunding"
  const paid = status === "confirmed" || inProgress
  const staffMayRefund = paid && !alreadyRefunded
  const credit = order.repairCreditTotal ?? 0

  if (alreadyRefunded) {
    return {
      alreadyRefunded: true,
      inProgress: false,
      staffMayRefund: false,
      customerFacing: "This order already shows as refunded. Do not promise another refund.",
      staffNote: `Order is refunded. Amount on file $${order.amount.toFixed(2)}.`,
    }
  }

  if (inProgress) {
    return {
      alreadyRefunded: false,
      inProgress: true,
      staffMayRefund: true,
      customerFacing: "A refund is already in progress. Do not promise a new payout or timeline.",
      staffNote: `Refunding. Staff can finish from the case if admin. Amount $${order.amount.toFixed(2)}.`,
    }
  }

  if (!paid) {
    return {
      alreadyRefunded: false,
      inProgress: false,
      staffMayRefund: false,
      customerFacing: "This order is not a confirmed paid sale. Do not promise a refund.",
      staffNote: `Status ${order.status}. Not eligible for a marketplace refund yet.`,
    }
  }

  const creditNote =
    credit > 0
      ? ` Repair credit $${credit.toFixed(2)} is already on the case — a refund can double-pay.`
      : ""

  return {
    alreadyRefunded: false,
    inProgress: false,
    staffMayRefund: true,
    customerFacing:
      "Staff may review a refund. Do not tell the customer it is approved or already issued.",
    staffNote: `Confirmed. Staff (admin) may refund $${order.amount.toFixed(2)} (${order.paymentMethod || "unknown pay"}). Suggested plan ${suggestedStaffPlan(order)}.${creditNote}`,
  }
}
