/** Machine keys written to listing_visibility_events.source */
export const LISTING_VISIBILITY_SOURCES = [
  "admin_site_visibility",
  "admin_status",
  "admin_restore",
  "seller_vacation",
  "seller_inactivity",
  "seller_archive",
  "seller_relist",
  "publish_draft",
  "impersonate_update",
  "system",
] as const

export type ListingVisibilitySource = (typeof LISTING_VISIBILITY_SOURCES)[number]

const SOURCE_LABELS: Record<ListingVisibilitySource, string> = {
  admin_site_visibility: "Admin hide / unhide",
  admin_status: "Admin status change",
  admin_restore: "Admin restore (hidden list)",
  seller_vacation: "Seller vacation mode",
  seller_inactivity: "Auto vacation (inactive seller)",
  seller_archive: "Seller archived listing",
  seller_relist: "Seller relisted",
  publish_draft: "Published from draft",
  impersonate_update: "Admin impersonation edit",
  system: "System",
}

export function listingVisibilitySourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown (before audit)"
  if (source in SOURCE_LABELS) {
    return SOURCE_LABELS[source as ListingVisibilitySource]
  }
  return source.replace(/_/g, " ")
}
