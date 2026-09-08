import { formatCarrierDisplayName } from '@/lib/shipping/resolve-carrier-code'

export type AdminOrderDisplayTone = 'green' | 'amber' | 'blue' | 'red' | 'violet' | 'slate'

export type AdminOrderDisplayKind =
  | 'pending_payment'
  | 'refunding'
  | 'refunded'
  | 'awaiting_shipping'
  | 'in_transit'
  | 'delivered'
  | 'awaiting_pickup'
  | 'picked_up'
  | 'confirmed'

export interface AdminOrderFulfillmentInput {
  status: string
  fulfillment_method: string | null
  delivery_status: string | null
  tracking_carrier?: string | null
  carrier_delivered_at?: string | null
}

export interface AdminOrderDisplayStatus {
  kind: AdminOrderDisplayKind
  label: string
  tone: AdminOrderDisplayTone
}

const TONE_BY_KIND: Record<AdminOrderDisplayKind, AdminOrderDisplayTone> = {
  pending_payment: 'amber',
  refunding: 'blue',
  refunded: 'red',
  awaiting_shipping: 'amber',
  in_transit: 'blue',
  delivered: 'green',
  awaiting_pickup: 'violet',
  picked_up: 'green',
  confirmed: 'green',
}

function deliveredLabel(carrier: string | null | undefined): string {
  const name = formatCarrierDisplayName(carrier, carrier)
  if (!carrier?.trim() || name === 'Carrier') return 'Delivered'
  return `Delivered · ${name}`
}

/** Operational status for the admin orders table — payment first, then fulfillment. */
export function resolveAdminOrderDisplayStatus(
  row: AdminOrderFulfillmentInput,
): AdminOrderDisplayStatus {
  if (row.status === 'pending') {
    return { kind: 'pending_payment', label: 'Pending', tone: TONE_BY_KIND.pending_payment }
  }
  if (row.status === 'refunding') {
    return { kind: 'refunding', label: 'Refunding', tone: TONE_BY_KIND.refunding }
  }
  if (row.status === 'refunded') {
    return { kind: 'refunded', label: 'Refunded', tone: TONE_BY_KIND.refunded }
  }

  const delivery = row.delivery_status
  const carrierDelivered = Boolean(row.carrier_delivered_at) || delivery === 'delivered'

  if (row.fulfillment_method === 'shipping') {
    if (carrierDelivered) {
      return {
        kind: 'delivered',
        label: deliveredLabel(row.tracking_carrier),
        tone: TONE_BY_KIND.delivered,
      }
    }
    if (delivery === 'shipped') {
      return { kind: 'in_transit', label: 'In transit', tone: TONE_BY_KIND.in_transit }
    }
    return {
      kind: 'awaiting_shipping',
      label: 'Awaiting shipping',
      tone: TONE_BY_KIND.awaiting_shipping,
    }
  }

  if (row.fulfillment_method === 'pickup') {
    if (delivery === 'picked_up') {
      return { kind: 'picked_up', label: 'Picked up', tone: TONE_BY_KIND.picked_up }
    }
    return {
      kind: 'awaiting_pickup',
      label: 'Awaiting pickup',
      tone: TONE_BY_KIND.awaiting_pickup,
    }
  }

  return { kind: 'confirmed', label: 'Confirmed', tone: TONE_BY_KIND.confirmed }
}
