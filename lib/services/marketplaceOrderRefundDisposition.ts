import { z } from "zod"

/**
 * Admin / system plans for what happens to listings + buyer messaging after a
 * full marketplace order refund. Money movement (Stripe/wallet + seller clawback)
 * is the same for every disposition; only side effects differ.
 */
export const MARKETPLACE_ORDER_REFUND_DISPOSITIONS = [
  /** Existing default: public relist + 5-day exclusive + "buy again" thread card. */
  "exclusive_relist",
  /** Refund only for listing side effects: sold → active, vacation-hidden, no rebuy message. */
  "vacation_hold",
  /** Never-shipped cancel: best-effort void unused outbound label, then vacation hold. */
  "cancel_unshipped",
  /** Public relist for anyone immediately — no exclusive window / buy-again card. */
  "public_relist",
] as const

export type MarketplaceOrderRefundDisposition =
  (typeof MARKETPLACE_ORDER_REFUND_DISPOSITIONS)[number]

export const DEFAULT_MARKETPLACE_ORDER_REFUND_DISPOSITION: MarketplaceOrderRefundDisposition =
  "exclusive_relist"

const dispositionSchema = z.enum(MARKETPLACE_ORDER_REFUND_DISPOSITIONS)

export function parseMarketplaceOrderRefundDisposition(
  value: unknown,
): MarketplaceOrderRefundDisposition | null {
  const parsed = dispositionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function resolveMarketplaceOrderRefundDisposition(
  value: unknown,
): MarketplaceOrderRefundDisposition {
  return parseMarketplaceOrderRefundDisposition(value) ?? DEFAULT_MARKETPLACE_ORDER_REFUND_DISPOSITION
}

export type MarketplaceOrderRefundSideEffectPlan = {
  disposition: MarketplaceOrderRefundDisposition
  /** sold → active with site visibility */
  listingVisibility: "public" | "vacation"
  grantExclusiveBuyerWindow: boolean
  notifyExclusiveRepurchase: boolean
  /** Best-effort void of unused ShipEngine outbound label before money refund. */
  voidUnusedOutboundLabel: boolean
}

export function planMarketplaceOrderRefundSideEffects(
  disposition: MarketplaceOrderRefundDisposition,
): MarketplaceOrderRefundSideEffectPlan {
  switch (disposition) {
    case "vacation_hold":
      return {
        disposition,
        listingVisibility: "vacation",
        grantExclusiveBuyerWindow: false,
        notifyExclusiveRepurchase: false,
        voidUnusedOutboundLabel: false,
      }
    case "cancel_unshipped":
      return {
        disposition,
        listingVisibility: "vacation",
        grantExclusiveBuyerWindow: false,
        notifyExclusiveRepurchase: false,
        voidUnusedOutboundLabel: true,
      }
    case "public_relist":
      return {
        disposition,
        listingVisibility: "public",
        grantExclusiveBuyerWindow: false,
        notifyExclusiveRepurchase: false,
        voidUnusedOutboundLabel: false,
      }
    case "exclusive_relist":
    default:
      return {
        disposition: "exclusive_relist",
        listingVisibility: "public",
        grantExclusiveBuyerWindow: true,
        notifyExclusiveRepurchase: true,
        voidUnusedOutboundLabel: false,
      }
  }
}

export type AdminRefundDispositionOption = {
  value: MarketplaceOrderRefundDisposition
  label: string
  description: string
  recommendedWhen: string
}

/** Copy for the admin refund picker — keep in sync with side-effect plan above. */
export const ADMIN_REFUND_DISPOSITION_OPTIONS: readonly AdminRefundDispositionOption[] = [
  {
    value: "exclusive_relist",
    label: "Buyer repurchase window",
    description:
      "Refund the buyer, reverse seller earnings, re-list publicly, and give the original buyer a 5-day exclusive “buy it again” window in Messages.",
    recommendedWhen: "Sale fell through but the item should stay sellable — buyer gets first dibs.",
  },
  {
    value: "vacation_hold",
    label: "Refund + seller vacation",
    description:
      "Refund the buyer and reverse seller earnings. Listing returns to the seller as active but on vacation (hidden from the site). No “buy it again” message. No new shipping label.",
    recommendedWhen: "Problem order where the seller should hold the listing offline until ready.",
  },
  {
    value: "cancel_unshipped",
    label: "Cancel never shipped",
    description:
      "Refunds the buyer the full order total (item + the shipping they paid). Voids any unused outbound ShipEngine label so Reswell can recover postage to the ShipEngine balance. Listing goes on seller vacation — no “buy it again” message. Does not buy a return label.",
    recommendedWhen: "Order confirmed but never shipped / label purchased but unused.",
  },
  {
    value: "public_relist",
    label: "Refund + public relist",
    description:
      "Refund the buyer and put the listing back on the market for everyone immediately. No exclusive window and no “buy it again” message.",
    recommendedWhen: "You want the item live again without favoring the original buyer.",
  },
] as const
