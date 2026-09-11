/** Vacation mode is only for live or pending-sale listings. */
export function canUseListingVacationMode(status: string | null | undefined): boolean {
  const normalized = status?.trim() ?? ""
  return normalized === "active" || normalized === "pending_sale"
}
