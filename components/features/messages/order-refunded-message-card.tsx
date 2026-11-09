"use client"

import Link from "next/link"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
} from "@/components/features/messages/thread-event-card"
import type { OrderRefundedMessagePayload } from "@/lib/validations/order-refunded-message-metadata"

export function OrderRefundedMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderRefundedMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderId, orderNum, listingTitle, listingTitles } = payload
  const titles = listingTitles?.length ? listingTitles : [listingTitle]
  const dashboardHref = viewerIsSeller
    ? `/dashboard/sales/${orderId}`
    : `/dashboard/purchases/${orderId}`

  return (
    <ThreadEventCard
      icon={RotateCcw}
      tone="warning"
      title="Refund issued"
      subtitle={`#${orderNum}`}
      createdAt={createdAt}
    >
      <ThreadEventListings titles={titles} />
      <ThreadEventHint>
        {viewerIsSeller
          ? "The listing is live again, and earnings from this sale were reversed."
          : "The listing is back on the market."}
      </ThreadEventHint>
      <ThreadEventActions>
        <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
          <Link href={dashboardHref}>{viewerIsSeller ? "View sale" : "View purchase"}</Link>
        </Button>
      </ThreadEventActions>
    </ThreadEventCard>
  )
}
