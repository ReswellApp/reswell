import { CARRIER_SCANNED_STATUS_CODES } from "@/lib/shipping/carrier-status-display"
import { carrierEventIsPreScan } from "@/lib/shipping/label-carrier-scan"

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

const SHIPPING_LABEL_CREATED = "Shipping Label Created"
const SELLER_MARKED_SHIPPED = "Seller marked shipped"

function looksDelivered(title: string): boolean {
  return /\bdeliver/i.test(title)
}

function scanTitle(description: string | null | undefined): string {
  const title = description?.trim()
  return title && title.length > 0 ? title : "Carrier update"
}

/** A carrier message past label creation means the package was scanned in. */
function carrierEventIsPhysicalScan(description: string | null | undefined): boolean {
  const text = description?.trim() ?? ""
  if (!text) return false
  return !carrierEventIsPreScan(text)
}

function statusCodeMeansCarrierScan(statusCode: string | null | undefined): boolean {
  const code = (statusCode ?? "").trim().toUpperCase()
  return CARRIER_SCANNED_STATUS_CODES.has(code)
}

function labelCreatedStep(): PurchaseTimelineEvent {
  return {
    id: "label-created",
    title: SHIPPING_LABEL_CREATED,
    occurredAt: null,
    state: "done",
  }
}

function sellerMarkedShippedStep(occurredAt: string | null): PurchaseTimelineEvent {
  return {
    id: "seller-shipped",
    title: SELLER_MARKED_SHIPPED,
    occurredAt,
    state: "done",
  }
}

type ClassifiedCarrierStep = PurchaseTimelineEvent & { physical: boolean }

/**
 * Oldest-first shipping story for the purchase details page.
 * Purchased is always first. A label step appears once tracking exists.
 * Seller marked shipped appears only after the carrier scans the package in.
 * Carrier scans are stored newest-first; this reverses them and caps the list.
 */
export function buildPurchaseDetailTimeline(input: {
  createdAt: string
  fulfillmentMethod: string | null
  deliveryStatus: string
  orderStatus: string
  hasTrackingNumber: boolean
  /** ShipEngine status code. Used only when the event list is empty. */
  carrierStatusCode?: string | null
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
  const carrierSteps: ClassifiedCarrierStep[] = visible.map((event, index) => ({
    id: `carrier-${index}-${event.occurred_at ?? "scan"}`,
    title: scanTitle(event.description),
    occurredAt: event.occurred_at ?? null,
    state: "done",
    physical: carrierEventIsPhysicalScan(event.description),
  }))

  const refunded = input.orderStatus === "refunded"
  const refunding = input.orderStatus === "refunding"
  if (refunded || refunding) {
    return [
      purchased,
      ...carrierSteps.map(toTimelineEvent),
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
    const steps = withShippingMilestones(carrierSteps, input, delivered).map(toTimelineEvent)
    return [purchased, ...steps]
  }

  return shippingSkeleton(purchased, input, delivered)
}

function toTimelineEvent(step: ClassifiedCarrierStep): PurchaseTimelineEvent {
  return {
    id: step.id,
    title: step.title,
    occurredAt: step.occurredAt,
    state: step.state,
  }
}

/**
 * Label paperwork stays before the handoff. A tracking number with no label
 * event still gets a label step. Seller marked shipped is inserted at the
 * first physical scan — a tracking number or "shipped" delivery status is not
 * enough, because labels are bought at checkout.
 */
function withShippingMilestones(
  carrierSteps: ClassifiedCarrierStep[],
  input: { hasTrackingNumber: boolean; actualDeliveryAt: string | null },
  delivered: boolean,
): ClassifiedCarrierStep[] {
  const steps = [...carrierSteps]
  const hasLabelEvent = steps.some((step) => carrierEventIsPreScan(step.title))
  if (input.hasTrackingNumber && !hasLabelEvent) {
    steps.unshift({ ...labelCreatedStep(), physical: false })
  }

  const scanIndex = steps.findIndex((step) => step.physical)
  const carrierSaysShipped = steps.some((step) => step.physical && /\bshipped\b/i.test(step.title))
  if ((scanIndex >= 0 || delivered) && !carrierSaysShipped) {
    const occurredAt = scanIndex >= 0 ? (steps[scanIndex]?.occurredAt ?? null) : input.actualDeliveryAt
    const seller: ClassifiedCarrierStep = { ...sellerMarkedShippedStep(occurredAt), physical: false }
    if (scanIndex >= 0) steps.splice(scanIndex, 0, seller)
    else steps.push(seller)
  }

  if (delivered && !steps.some((step) => looksDelivered(step.title))) {
    steps.push({
      id: "delivered",
      title: "Delivered",
      occurredAt: input.actualDeliveryAt,
      state: "done",
      physical: true,
    })
  }

  return steps
}

/** No carrier events yet. Do not invent a handoff from the tracking number alone. */
function shippingSkeleton(
  purchased: PurchaseTimelineEvent,
  input: {
    hasTrackingNumber: boolean
    carrierStatusCode?: string | null
    actualDeliveryAt: string | null
  },
  delivered: boolean,
): PurchaseTimelineEvent[] {
  const scanned = delivered || statusCodeMeansCarrierScan(input.carrierStatusCode)
  const steps: PurchaseTimelineEvent[] = [purchased]

  if (input.hasTrackingNumber) {
    steps.push(labelCreatedStep())
  } else if (!scanned) {
    steps.push({
      id: "waiting-ship",
      title: "Waiting for the seller to ship",
      occurredAt: null,
      state: "current",
    })
  }

  if (scanned) {
    steps.push(sellerMarkedShippedStep(delivered ? input.actualDeliveryAt : null))
  }

  if (!input.hasTrackingNumber || scanned) {
    steps.push({
      id: "delivered",
      title: "Delivered",
      occurredAt: delivered ? input.actualDeliveryAt : null,
      state: delivered ? "done" : "upcoming",
    })
  }

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
