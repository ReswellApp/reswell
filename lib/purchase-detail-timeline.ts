export type PurchaseTimelineEvent = {
  id: string
  title: string
  occurredAt: string | null
  state: "done" | "current" | "upcoming"
}

type CarrierScan = {
  occurred_at?: string
  description?: string | null
}

function looksDelivered(title: string): boolean {
  return /\bdeliver/i.test(title)
}

function scanTitle(description: string | null | undefined): string {
  const title = description?.trim()
  return title && title.length > 0 ? title : "Carrier update"
}

/**
 * Oldest-first shipping story for the purchase details page.
 * Carrier scans are stored newest-first; this reverses them and caps the list.
 */
export function buildPurchaseDetailTimeline(input: {
  createdAt: string
  fulfillmentMethod: string | null
  deliveryStatus: string
  orderStatus: string
  hasTrackingNumber: boolean
  carrierName: string | null
  events: CarrierScan[]
  actualDeliveryAt: string | null
  refundedAt: string | null
}): PurchaseTimelineEvent[] {
  const purchased: PurchaseTimelineEvent = {
    id: "purchased",
    title: "Purchased",
    occurredAt: input.createdAt,
    state: "done",
  }

  const chronological = [...input.events].reverse()
  const visible = chronological.length > 10 ? chronological.slice(-10) : chronological
  const carrierSteps: PurchaseTimelineEvent[] = visible.map((event, index) => ({
    id: `carrier-${index}-${event.occurred_at ?? "scan"}`,
    title: scanTitle(event.description),
    occurredAt: event.occurred_at ?? null,
    state: "done",
  }))

  const refunded = input.orderStatus === "refunded"
  const refunding = input.orderStatus === "refunding"
  if (refunded || refunding) {
    return [
      purchased,
      ...carrierSteps,
      {
        id: "refund",
        title: refunded ? "Refunded" : "Refund in progress",
        occurredAt: refunded ? input.refundedAt : null,
        state: refunded ? "done" : "current",
      },
    ]
  }

  if (input.fulfillmentMethod === "pickup") {
    if (input.deliveryStatus === "picked_up") {
      return [purchased, { id: "picked-up", title: "Picked up", occurredAt: null, state: "done" }]
    }
    if (input.deliveryStatus === "pickup_ready") {
      return [
        purchased,
        { id: "pickup-ready", title: "Ready for pickup", occurredAt: null, state: "current" },
      ]
    }
    return [purchased, { id: "meet", title: "Meet the seller", occurredAt: null, state: "current" }]
  }

  const delivered = input.deliveryStatus === "delivered"

  if (carrierSteps.length > 0) {
    const steps = [...carrierSteps]
    const sellerShipped =
      delivered || input.deliveryStatus === "shipped" || input.hasTrackingNumber
    const scanAlreadySaysShipped = steps.some((step) => /\bshipped\b/i.test(step.title))
    if (sellerShipped && !scanAlreadySaysShipped) {
      steps.unshift({
        id: "seller-shipped",
        title: "Seller marked shipped",
        occurredAt: null,
        state: "done",
      })
    }
    if (delivered && !steps.some((step) => looksDelivered(step.title))) {
      steps.push({
        id: "delivered",
        title: "Delivered",
        occurredAt: input.actualDeliveryAt,
        state: "done",
      })
    }
    return [purchased, ...steps]
  }

  const markedShipped =
    delivered || input.deliveryStatus === "shipped" || input.hasTrackingNumber
  const steps: PurchaseTimelineEvent[] = [
    purchased,
    markedShipped
      ? { id: "seller-shipped", title: "Seller marked shipped", occurredAt: null, state: "done" }
      : {
          id: "waiting-ship",
          title: "Waiting for the seller to ship",
          occurredAt: null,
          state: "current",
        },
  ]

  if (input.hasTrackingNumber && !delivered) {
    const carrier = input.carrierName?.trim()
    steps.push({
      id: "accepted",
      title: carrier ? `Accepted by ${carrier}` : "Accepted by carrier",
      occurredAt: null,
      state: "current",
    })
  }

  steps.push({
    id: "delivered",
    title: "Delivered",
    occurredAt: delivered ? input.actualDeliveryAt : null,
    state: delivered ? "done" : "upcoming",
  })

  return steps
}

/** Date shown under the status banner. Delivery and refund dates are not the purchase date. */
export function purchaseDetailStatusDate(input: {
  deliveryStatus: string
  orderStatus: string
  createdAt: string
  actualDeliveryAt: string | null
  refundedAt: string | null
}): string | null {
  if (input.orderStatus === "refunded") return input.refundedAt
  if (input.deliveryStatus === "delivered" || input.deliveryStatus === "picked_up") {
    return input.actualDeliveryAt
  }
  return input.createdAt
}
