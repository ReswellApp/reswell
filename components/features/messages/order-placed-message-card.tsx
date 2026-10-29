"use client"

import Link from "next/link"
import { CreditCard, MapPin, Package, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
  ThreadEventMeta,
  ThreadEventMetaRow,
} from "@/components/features/messages/thread-event-card"
import type { OrderPlacedMessagePayload } from "@/lib/validations/order-placed-message-metadata"

function paymentLabel(method: OrderPlacedMessagePayload["paymentMethod"]): string {
  if (method === "reswell_bucks") return "Wallet"
  return "Card"
}

function fulfillmentCopy(
  fulfillment: OrderPlacedMessagePayload["fulfillment"],
  viewerIsSeller: boolean,
): { label: string; hint: string; Icon: typeof MapPin } {
  if (fulfillment === "shipping") {
    return {
      label: "Shipping",
      hint: viewerIsSeller
        ? "Ship from your sale page when it’s packed."
        : "Tracking appears here once the seller ships.",
      Icon: Truck,
    }
  }
  return {
    label: "Local pickup",
    hint: "Reply in this thread to coordinate a time to meet.",
    Icon: MapPin,
  }
}

export function OrderPlacedMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderPlacedMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderId, orderNum, listingTitle, listingTitles, total, fulfillment, paymentMethod } = payload
  const titles = listingTitles?.length ? listingTitles : [listingTitle]
  const { label: fulfillLabel, hint: fulfillHint, Icon: FulfillIcon } = fulfillmentCopy(
    fulfillment,
    viewerIsSeller,
  )
  const dashboardHref = viewerIsSeller
    ? `/dashboard/sales/${orderId}`
    : `/dashboard/purchases/${orderId}`

  return (
    <ThreadEventCard
      icon={Package}
      title="Order placed"
      subtitle={`#${orderNum}`}
      amount={`$${total.toFixed(2)}`}
      createdAt={createdAt}
    >
      <ThreadEventListings titles={titles} />
      <ThreadEventMeta>
        <ThreadEventMetaRow icon={CreditCard}>Paid with {paymentLabel(paymentMethod)}</ThreadEventMetaRow>
        <ThreadEventMetaRow icon={FulfillIcon}>{fulfillLabel}</ThreadEventMetaRow>
      </ThreadEventMeta>
      <ThreadEventHint>{fulfillHint}</ThreadEventHint>
      <ThreadEventActions>
        <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
          <Link href={dashboardHref}>{viewerIsSeller ? "View sale" : "View purchase"}</Link>
        </Button>
      </ThreadEventActions>
    </ThreadEventCard>
  )
}
