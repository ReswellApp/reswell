"use client"

import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
} from "@/components/features/messages/thread-event-card"
import type { OrderCompletedMessagePayload } from "@/lib/validations/order-completed-message-metadata"

export function OrderCompletedMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderCompletedMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderId, orderNum, listingTitle } = payload
  const dashboardHref = viewerIsSeller
    ? `/dashboard/sales/${orderId}`
    : `/dashboard/purchases/${orderId}`

  return (
    <ThreadEventCard
      icon={CheckCircle2}
      tone="success"
      title="Pickup complete"
      subtitle={`#${orderNum}`}
      createdAt={createdAt}
    >
      <ThreadEventListings titles={[listingTitle]} />
      <ThreadEventHint>
        {viewerIsSeller
          ? "This sale is finalized. Open it anytime for receipts and status."
          : "Open your purchase anytime for receipts and status."}
      </ThreadEventHint>
      <ThreadEventActions>
        <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
          <Link href={dashboardHref}>{viewerIsSeller ? "View sale" : "View purchase"}</Link>
        </Button>
      </ThreadEventActions>
    </ThreadEventCard>
  )
}
