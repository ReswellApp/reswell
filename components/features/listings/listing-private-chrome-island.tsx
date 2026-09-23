"use client"

import { useEffect, useState } from "react"
import { ListingDetailAdminBar } from "@/components/features/listings/listing-detail-admin-bar"
import { ListingSoldOwnerNotice } from "@/components/listing-sold-detail-notice"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { loadListingPrivateChrome } from "@/lib/actions/listing-private-chrome"
import type { ListingPrivateChrome } from "@/lib/listing-private-chrome"
import {
  listingAdminBarSnapshotFromRow,
  type ListingAdminBarSnapshot,
} from "@/lib/listing-detail-admin-bar"

function sectionLabel(section: string): string {
  if (section === "surfboards") return "board"
  if (section.endsWith("s")) return section.slice(0, -1)
  return section
}

/**
 * Admin bar and sold-owner notice for a cached listing page. Absent from the
 * HTML until the browser session says this viewer is the owner or an admin.
 * Seller edit/end/vacation controls stay in the listing column — not here.
 */
export function ListingPrivateChromeIsland({
  listing,
}: {
  listing: Record<string, unknown>
}) {
  const listingId = typeof listing.id === "string" ? listing.id : ""
  const [chrome, setChrome] = useState<ListingPrivateChrome | null>(null)
  const snapshot: ListingAdminBarSnapshot | null = listingAdminBarSnapshotFromRow(listing)

  useEffect(() => {
    if (!listingId || !hasSupabaseAuthCookiesClient()) return
    let cancelled = false
    void loadListingPrivateChrome(listingId).then((next) => {
      if (!cancelled) setChrome(next)
    })
    return () => {
      cancelled = true
    }
  }, [listingId])

  if (!chrome || !listingId) return null

  const section = typeof listing.section === "string" ? listing.section : ""
  const status = typeof listing.status === "string" ? listing.status : ""

  return (
    <>
      {chrome.isAdmin && snapshot ? (
        <ListingDetailAdminBar listing={snapshot} cartHolders={chrome.adminHolders} />
      ) : null}
      {chrome.owner && status === "sold" ? (
        <div className="container mx-auto px-4 pt-4 sm:px-6">
          <ListingSoldOwnerNotice
            dashboardListingsHref="/dashboard/listings"
            sectionLabel={sectionLabel(section)}
            listingId={listingId}
            canRelist={chrome.owner.canRelist}
          />
        </div>
      ) : null}
    </>
  )
}
