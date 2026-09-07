"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import posthog from "posthog-js"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

/** Deduplicate React Strict Mode double effect + fast remounts. */
const lastSentAt = new Map<string, number>()
const DEDUPE_MS = 2500

function listingTypeFromSellPath(
  pathname: string,
  search: URLSearchParams,
): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== "sell") return "unknown"

  const subpath = segments[1]
  if (!subpath) {
    if (search.get("edit") || search.get("type") === "surfboard") {
      return "surfboards"
    }
    return "hub"
  }
  if (subpath === "boards") return "surfboards"
  if (subpath === "edit") return "edit"
  if (isPeerListingSection(subpath)) return subpath
  return subpath
}

/**
 * Fires once per real visit to any `/sell` route so the seller funnel has a
 * reliable top-of-funnel event for the hub (`/sell`) and every category flow
 * (`/sell/boards`, `/sell/fins`, …).
 */
export function SellFlowViewedTracker(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams?.toString() ?? ""

  useEffect(() => {
    if (!pathname?.startsWith("/sell")) return

    const params = new URLSearchParams(search)
    const listingType = listingTypeFromSellPath(pathname, params)
    const isEdit = Boolean(params.get("edit")) || pathname.startsWith("/sell/edit")
    const key = `${pathname}:${listingType}:${isEdit ? "edit" : "create"}`
    const now = Date.now()
    if (now - (lastSentAt.get(key) ?? 0) < DEDUPE_MS) return
    lastSentAt.set(key, now)

    posthog.capture("sell_flow_viewed", {
      path: pathname,
      listing_type: listingType,
      is_edit: isEdit,
    })
  }, [pathname, search])

  return null
}
