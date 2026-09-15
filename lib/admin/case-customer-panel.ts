import type { SupportCaseKind, SupportCaseStatus } from "@/lib/types/supportCase"

export const CUSTOMER_PANEL_PAGE_SIZE = 8

export type CustomerPanelFlagTone = "secondary" | "outline" | "destructive"

export type CustomerPanelFlag = {
  id: string
  label: string
  tone: CustomerPanelFlagTone
}

export type SupportCaseCustomerOrder = {
  id: string
  orderRef: string | null
  role: "buyer" | "seller"
  amount: number
  merchandiseAmount: number
  status: string
  createdAt: string
  listingId: string | null
  listingTitle: string | null
}

export type SupportCaseCustomerTicket = {
  id: string
  subject: string
  status: SupportCaseStatus | string
  kind: SupportCaseKind | string
  orderRef: string | null
  priority: string
  updatedAt: string
  createdAt: string
}

export type CustomerPanelCommerce = {
  purchases: number
  purchaseSpend: number
  sales: number
  salesVolume: number
  listings: number
  activeListings: number
  soldListings: number
}

export type CaseInboxThisOrderSnapshot = {
  id: string
  orderRef: string | null
  status: string
  amount: number
  itemPrice: number
  shippingAmount: number
  paymentMethod: string
  fulfillmentMethod: string | null
  deliveryStatus: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  carrierDeliveredAt: string | null
  listingTitle: string | null
  refundedAt: string | null
  payoutStatus: string | null
  payoutHoldReason: string | null
  pickupCode: string | null
}

export function merchandiseAmount(amount: number, shippingAmount: number): number {
  return Math.max(0, amount - shippingAmount)
}

export function formatCustomerUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function emptyCustomerCommerce(): CustomerPanelCommerce {
  return {
    purchases: 0,
    purchaseSpend: 0,
    sales: 0,
    salesVolume: 0,
    listings: 0,
    activeListings: 0,
    soldListings: 0,
  }
}

export function toSupportCaseCustomerOrder(
  order: {
    id: string
    order_num: string | null
    seller_id: string | null
    buyer_id: string | null
    amount: number
    shipping_amount: number
    status: string
    created_at: string
    listing_id: string | null
    listing_title: string | null
  },
  userId: string,
): SupportCaseCustomerOrder {
  return {
    id: order.id,
    orderRef: order.order_num,
    role: order.seller_id === userId ? "seller" : "buyer",
    amount: order.amount,
    merchandiseAmount: merchandiseAmount(order.amount, order.shipping_amount),
    status: order.status,
    createdAt: order.created_at,
    listingId: order.listing_id,
    listingTitle: order.listing_title,
  }
}

export function toSupportCaseCustomerTicket(row: {
  id: string
  subject: string
  status: string
  kind: string
  order_ref: string | null
  priority?: string | null
  updated_at: string
  created_at: string
}): SupportCaseCustomerTicket {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    kind: row.kind,
    orderRef: row.order_ref,
    priority: row.priority ?? "normal",
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export function buildCustomerPanelFlags(input: {
  hasProfile: boolean
  matchedByEmail: boolean
  isShop: boolean
  verified: boolean
  sellerBanned: boolean
  isStaff: boolean
  openTicketCount: number
}): CustomerPanelFlag[] {
  const flags: CustomerPanelFlag[] = []
  if (!input.hasProfile) {
    flags.push({ id: "guest", label: "Guest / no account", tone: "outline" })
  }
  if (input.matchedByEmail) {
    flags.push({ id: "email_match", label: "Email match", tone: "outline" })
  }
  if (input.isStaff) {
    flags.push({ id: "staff", label: "Staff account", tone: "outline" })
  }
  if (input.verified) {
    flags.push({ id: "verified", label: "Verified shop", tone: "secondary" })
  } else if (input.isShop) {
    flags.push({ id: "shop", label: "Shop", tone: "secondary" })
  }
  if (input.sellerBanned) {
    flags.push({ id: "seller_banned", label: "Seller banned", tone: "destructive" })
  }
  if (input.openTicketCount > 0) {
    flags.push({
      id: "open_tickets",
      label:
        input.openTicketCount === 1
          ? "1 open ticket"
          : `${input.openTicketCount} open tickets`,
      tone: "outline",
    })
  }
  return flags
}

export function thisOrderSnapshotFromAdminOrder(order: {
  id: string
  order_num: string | null
  status: string
  amount: number
  item_price: number
  shipping_amount: number
  payment_method: string
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  carrier_delivered_at: string | null
  listing_title: string | null
  refunded_at: string | null
  pickup_code: string | null
  payout: { status: string; hold_reason: string | null } | null
}): CaseInboxThisOrderSnapshot {
  return {
    id: order.id,
    orderRef: order.order_num,
    status: order.status,
    amount: order.amount,
    itemPrice: order.item_price,
    shippingAmount: order.shipping_amount,
    paymentMethod: order.payment_method,
    fulfillmentMethod: order.fulfillment_method,
    deliveryStatus: order.delivery_status,
    trackingNumber: order.tracking_number,
    trackingCarrier: order.tracking_carrier,
    carrierDeliveredAt: order.carrier_delivered_at,
    listingTitle: order.listing_title,
    refundedAt: order.refunded_at,
    payoutStatus: order.payout?.status ?? null,
    payoutHoldReason: order.payout?.hold_reason ?? null,
    pickupCode: order.pickup_code,
  }
}
