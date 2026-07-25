import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchLatestHideEventsForListings,
  type ListingVisibilityEventRow,
} from "@/lib/db/listingVisibilityEvents"

export type AdminHiddenListingRow = {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  user_id: string
  hidden_from_site: boolean
  local_pickup: boolean | null
  shipping_available: boolean | null
  created_at: string
  updated_at: string
  profiles: { display_name: string | null; email: string | null } | null
  listing_images: { url: string }[]
  /** Latest hide event (or latest visibility event if no hide logged). */
  latest_visibility_event: ListingVisibilityEventRow | null
}

export type AdminHiddenListingsSummary = {
  totalHidden: number
  /** Live marketplace rows that 404 checkout and are absent from browse. */
  checkoutBlockedActive: number
  hiddenDraft: number
  hiddenSold: number
  hiddenRemoved: number
}

const ADMIN_HIDDEN_LISTING_SELECT = `
  id,
  slug,
  title,
  price,
  status,
  section,
  user_id,
  hidden_from_site,
  local_pickup,
  shipping_available,
  created_at,
  updated_at,
  profiles!listings_user_id_fkey(display_name, email),
  listing_images(url)
`.trim()

export function isCheckoutBlockedHiddenListing(row: {
  status: string | null
  hidden_from_site: boolean | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
}): boolean {
  if (row.hidden_from_site !== true) return false
  const status = String(row.status ?? "")
  if (status !== "active" && status !== "pending_sale") return false
  const lp = row.local_pickup !== false
  const sa = !!row.shipping_available
  return lp || sa
}

export function summarizeAdminHiddenListings(
  rows: AdminHiddenListingRow[],
): AdminHiddenListingsSummary {
  let checkoutBlockedActive = 0
  let hiddenDraft = 0
  let hiddenSold = 0
  let hiddenRemoved = 0

  for (const row of rows) {
    const status = String(row.status ?? "")
    if (isCheckoutBlockedHiddenListing(row)) {
      checkoutBlockedActive += 1
    } else if (status === "draft") {
      hiddenDraft += 1
    } else if (status === "sold") {
      hiddenSold += 1
    } else if (status === "removed") {
      hiddenRemoved += 1
    }
  }

  return {
    totalHidden: rows.length,
    checkoutBlockedActive,
    hiddenDraft,
    hiddenSold,
    hiddenRemoved,
  }
}

export async function fetchAdminHiddenListings(
  service: SupabaseClient,
  options?: { checkoutBlockedOnly?: boolean },
): Promise<{ rows: AdminHiddenListingRow[]; error: string | null }> {
  const { data, error } = await service
    .from("listings")
    .select(ADMIN_HIDDEN_LISTING_SELECT)
    .eq("hidden_from_site", true)
    .order("updated_at", { ascending: false })

  if (error) {
    return { rows: [], error: error.message }
  }

  let rows = (data ?? []) as unknown as Omit<
    AdminHiddenListingRow,
    "latest_visibility_event"
  >[]
  if (options?.checkoutBlockedOnly) {
    rows = rows.filter((row) => isCheckoutBlockedHiddenListing(row))
  }

  const latestByListing = await fetchLatestHideEventsForListings(
    service,
    rows.map((row) => row.id),
  )

  const withEvents: AdminHiddenListingRow[] = rows.map((row) => ({
    ...row,
    latest_visibility_event: latestByListing.get(row.id) ?? null,
  }))

  return { rows: withEvents, error: null }
}

export async function countCheckoutBlockedHiddenActiveListings(
  service: SupabaseClient,
): Promise<number> {
  const { rows, error } = await fetchAdminHiddenListings(service)
  if (error) return 0
  return summarizeAdminHiddenListings(rows).checkoutBlockedActive
}
