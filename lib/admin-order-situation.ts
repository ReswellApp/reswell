/**
 * Human-readable order situation for admin ops.
 * Used by `/admin/orders` list rows and the order workspace banner.
 */

export type AdminOrderSituationTone =
  | "neutral"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "rose"

export type AdminOrderSituationInput = {
  status: string
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number?: string | null
  tracking_carrier?: string | null
  pickup_code?: string | null
  has_prepared_label?: boolean
  is_reswell_shop?: boolean
  canFulfillReswellShop?: boolean
  payout?: {
    status: string
    hold_reason: string | null
    released_at: string | null
  } | null
}

export type AdminOrderSituation = {
  /** Short chip on list rows */
  label: string
  /** One-line next step */
  nextStep: string
  /** Longer copy for the order workspace banner */
  detail: string
  tone: AdminOrderSituationTone
  needsAttention: boolean
}

export function adminPaymentLabel(method: string): string {
  if (method === "stripe") return "Card"
  if (method === "reswell_bucks") return "Wallet"
  if (method === "cash") return "Cash"
  return method
}

export function adminFulfillmentLabel(method: string | null): string {
  if (method === "shipping") return "Shipping"
  if (method === "pickup") return "Local pickup"
  if (!method) return "—"
  return method.charAt(0).toUpperCase() + method.slice(1)
}

function hasTracking(trackingNumber: string | null | undefined): boolean {
  return Boolean(trackingNumber?.trim())
}

export function adminOrderSituation(input: AdminOrderSituationInput): AdminOrderSituation {
  const fulfillment = input.fulfillment_method
  const delivery = input.delivery_status
  const tracked = hasTracking(input.tracking_number)
  const carrier = input.tracking_carrier?.trim()

  if (input.status === "pending") {
    return {
      label: "Unpaid",
      nextStep: "Waiting for payment",
      detail: "Checkout has not completed. No fulfillment or payout until the buyer pays.",
      tone: "neutral",
      needsAttention: false,
    }
  }

  if (input.status === "refunding") {
    return {
      label: "Refunding",
      nextStep: "Sync refund from Stripe if this is stuck",
      detail:
        "A refund is in flight. Buyers and sellers already see “Refund in progress”. Sync from Stripe if the dashboard shows succeeded but this order is still refunding.",
      tone: "amber",
      needsAttention: true,
    }
  }

  if (input.status === "refunded") {
    return {
      label: "Refunded",
      nextStep: "Refund complete",
      detail: "The buyer was refunded and seller earnings were reversed. No further fulfillment.",
      tone: "rose",
      needsAttention: false,
    }
  }

  if (input.canFulfillReswellShop) {
    return {
      label: "Fulfill shop order",
      nextStep: "Buy a label and mark this shop order shipped",
      detail: "This is Reswell retail inventory. Purchase a ShipEngine label to fulfill and notify the buyer.",
      tone: "amber",
      needsAttention: true,
    }
  }

  if (fulfillment === "pickup") {
    if (delivery === "picked_up") {
      return {
        label: "Picked up",
        nextStep: pickupPayoutNextStep(input),
        detail: pickupPayoutDetail(input),
        tone: "emerald",
        needsAttention: input.payout?.status === "held" && input.payout.hold_reason === "awaiting_manual_release",
      }
    }
    return {
      label: "Waiting for pickup",
      nextStep: input.pickup_code
        ? `Buyer code ${input.pickup_code} — seller confirms at handoff`
        : "Waiting for the seller to confirm pickup",
      detail: input.pickup_code
        ? `The buyer shows code ${input.pickup_code} at handoff. Seller verification marks the order picked up and releases payout.`
        : "No pickup code on this order (common for in-person register sales). Confirm handoff with the seller if payout is still held.",
      tone: "violet",
      needsAttention: true,
    }
  }

  if (fulfillment === "shipping") {
    if (delivery === "delivered") {
      const payoutHeld =
        input.payout?.status === "held" && input.payout.hold_reason === "awaiting_manual_release"
      return {
        label: "Delivered",
        nextStep: shippingPayoutNextStep(input),
        detail: shippingPayoutDetail(input),
        tone: payoutHeld ? "amber" : "emerald",
        needsAttention: payoutHeld,
      }
    }

    if (delivery === "shipped") {
      return {
        label: "In transit",
        nextStep: carrier ? `Shipped with ${carrier}` : "On the way to the buyer",
        detail: tracked
          ? `Carrier tracking is live${carrier ? ` (${carrier})` : ""}. Payout releases automatically 24 hours after the carrier reports delivery.`
          : "Marked shipped. Add or confirm tracking if the buyer asks where the board is.",
        tone: "sky",
        needsAttention: false,
      }
    }

    if (!tracked && !input.has_prepared_label) {
      return {
        label: "Needs label",
        nextStep: "Seller still needs to ship — no tracking yet",
        detail:
          "This paid shipping order has no label or tracking. The seller should buy a Reswell label from their sale, or an admin can purchase one from Shipping.",
        tone: "amber",
        needsAttention: true,
      }
    }

    return {
      label: "Ready to ship",
      nextStep: "Label is ready — waiting for a carrier scan",
      detail:
        "A shipping label exists but the order is not marked shipped yet. It will move to in transit when the carrier scans the package.",
      tone: "amber",
      needsAttention: true,
    }
  }

  return {
    label: "Confirmed",
    nextStep: "Paid — check fulfillment",
    detail: "Payment is confirmed. Open fulfillment details if the buyer or seller needs help.",
    tone: "neutral",
    needsAttention: false,
  }
}

function pickupPayoutNextStep(input: AdminOrderSituationInput): string {
  if (input.payout?.status === "held" && input.payout.hold_reason === "awaiting_manual_release") {
    return "Approve seller payout"
  }
  if (input.payout?.status === "held") {
    return "Picked up — payout still held"
  }
  return "Pickup complete"
}

function pickupPayoutDetail(input: AdminOrderSituationInput): string {
  if (input.payout?.status === "held" && input.payout.hold_reason === "awaiting_manual_release") {
    return "Pickup was verified. This older order still needs an admin to approve the seller payout."
  }
  if (input.payout?.status === "held") {
    return "Pickup was verified. Seller payout is still on hold — check the payment panel."
  }
  return "The buyer picked up the board and seller payout has been released per the usual rules."
}

function shippingPayoutNextStep(input: AdminOrderSituationInput): string {
  if (input.payout?.status === "held") {
    if (input.payout.hold_reason === "awaiting_manual_release") return "Approve seller payout"
    if (input.payout.hold_reason === "awaiting_carrier_settlement") {
      return "Payout releases 24 hours after delivery"
    }
    return "Delivered — payout still held"
  }
  return "Delivered"
}

function shippingPayoutDetail(input: AdminOrderSituationInput): string {
  if (input.payout?.status === "held") {
    if (input.payout.hold_reason === "awaiting_manual_release") {
      return "The carrier delivered this order, but it does not use automatic payout. Approve the seller payout after you have verified delivery."
    }
    if (input.payout.hold_reason === "awaiting_carrier_settlement") {
      return "Carrier delivery is confirmed. Seller earnings release automatically 24 hours after the delivery timestamp."
    }
    return "Delivered, but the seller payout is still held. Check the payment panel for the hold reason."
  }
  return "The buyer has the board. Seller payout follows the usual release rules."
}
