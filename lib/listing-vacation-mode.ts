/** Vacation mode is only for live or pending-sale listings. */
export function canUseListingVacationMode(status: string | null | undefined): boolean {
  const normalized = status?.trim() ?? ""
  return normalized === "active" || normalized === "pending_sale"
}

/** Live listing currently hidden by vacation (not draft/admin/sold hide). */
export function listingIsOnVacation(params: {
  status: string | null | undefined
  hiddenFromSite: boolean | null | undefined
}): boolean {
  return params.hiddenFromSite === true && canUseListingVacationMode(params.status)
}
