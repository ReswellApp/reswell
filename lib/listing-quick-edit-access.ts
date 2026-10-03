/** Statuses a seller can change from the listings desk without the full sell editor. */
export const LISTING_QUICK_EDIT_STATUSES = ["active", "pending_sale", "pending", "draft"] as const

export function canQuickEditListing(status: string | null | undefined): boolean {
  const normalized = status?.trim() ?? ""
  return (LISTING_QUICK_EDIT_STATUSES as readonly string[]).includes(normalized)
}
