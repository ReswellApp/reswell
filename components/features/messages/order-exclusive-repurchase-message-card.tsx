"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
} from "@/components/features/messages/thread-event-card"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { OrderExclusiveRepurchaseMessagePayload } from "@/lib/validations/order-exclusive-repurchase-message-metadata"

function formatExclusiveUntilLabel(untilIso: string): string {
  const until = new Date(untilIso)
  if (Number.isNaN(until.getTime())) return "soon"
  return until.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  })
}

export function OrderExclusiveRepurchaseMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderExclusiveRepurchaseMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderNum, listingTitle, listingTitles, listingId, listingSlug, listingSection, exclusiveUntil } =
    payload
  const titles = listingTitles?.length ? listingTitles : [listingTitle]
  const untilLabel = formatExclusiveUntilLabel(exclusiveUntil)
  const listingParam = listingSlug?.trim() || listingId
  const listingHref = listingDetailHref({ id: listingId, slug: listingSlug ?? null })
  const section: PeerListingSection = isPeerListingSection(listingSection ?? "")
    ? (listingSection as PeerListingSection)
    : "surfboards"
  const checkoutHref = peerListingCheckoutHref(section, listingParam)

  return (
    <ThreadEventCard
      icon={ShoppingBag}
      tone="info"
      title="Buy again"
      subtitle={`#${orderNum}`}
      createdAt={createdAt}
    >
      <ThreadEventListings titles={titles} />
      <ThreadEventHint>
        {viewerIsSeller
          ? `This order was refunded and the listing is live again. The original buyer can repurchase exclusively through ${untilLabel}.`
          : `This order was refunded, but the listing is back on Reswell. You have exclusive access to buy it again through ${untilLabel}.`}
      </ThreadEventHint>
      <ThreadEventActions>
        {viewerIsSeller ? (
          <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
            <Link href={listingHref}>View listing</Link>
          </Button>
        ) : (
          <Button className={THREAD_EVENT_CTA_CLASS} variant="default" asChild>
            <Link href={checkoutHref}>Buy it now</Link>
          </Button>
        )}
      </ThreadEventActions>
    </ThreadEventCard>
  )
}
