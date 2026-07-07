"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Layers } from "lucide-react"
import {
  bulkListingProgress,
  getBulkListingSlot,
  loadBulkListingSession,
} from "@/lib/admin-bulk-listing-session"
import {
  PEER_LISTING_SECTION_LABELS,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import { cn } from "@/lib/utils"

interface AdminBulkListingBannerProps {
  section: PeerListingSection
  bulkSlotId?: string | null
  className?: string
}

export function AdminBulkListingBanner({
  section,
  bulkSlotId,
  className,
}: AdminBulkListingBannerProps) {
  const banner = useMemo(() => {
    if (!bulkSlotId) return null
    const session = loadBulkListingSession()
    if (!session) return null
    const slot = getBulkListingSlot(session, bulkSlotId)
    if (!slot || slot.section !== section) return null
    const { completed, total } = bulkListingProgress(session)
    const index = session.slots.findIndex((s) => s.id === bulkSlotId)
    return {
      index: index >= 0 ? index + 1 : completed + 1,
      total,
      completed,
      sectionLabel: PEER_LISTING_SECTION_LABELS[section],
    }
  }, [bulkSlotId, section])

  if (!banner) return null

  return (
    <div
      className={cn(
        "border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
        className,
      )}
    >
      <div className="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <Layers className="h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium">Bulk listing</span>{" "}
          <span className="text-sky-800 dark:text-sky-200">
            {banner.index} of {banner.total}
          </span>
          {" · "}
          <span>{banner.sectionLabel}</span>
          {" · "}
          <span className="tabular-nums">{banner.completed} complete</span>
        </p>
        <Link
          href="/admin/listings/bulk"
          className="ml-auto font-medium underline-offset-2 hover:underline"
        >
          Back to bulk dashboard
        </Link>
      </div>
    </div>
  )
}
