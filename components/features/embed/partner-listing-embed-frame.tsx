"use client"

import { useRef } from "react"
import type { PartnerEmbedPublicPayload } from "@/lib/db/partner-listing-embeds"
import {
  PartnerListingBannerClient,
  PartnerListingEmbedResize,
} from "@/components/features/embed/partner-listing-banner"

export function PartnerListingEmbedFrame({
  payload,
  slug,
  origin,
}: {
  payload: PartnerEmbedPublicPayload
  slug: string
  origin: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="relative min-h-0 bg-transparent text-foreground">
      <PartnerListingBannerClient payload={payload} containerRef={containerRef} />
      <PartnerListingEmbedResize slug={slug} origin={origin} containerRef={containerRef} />
    </div>
  )
}
