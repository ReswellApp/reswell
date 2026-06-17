/** Builds a shipping/legal full name from private profile fields. */
export function formatProfileLegalName(
  firstName?: string | null,
  lastName?: string | null,
  fallbackDisplayName?: string | null,
): string {
  const first = firstName?.trim() ?? ""
  const last = lastName?.trim() ?? ""
  const combined = [first, last].filter(Boolean).join(" ")
  if (combined) return combined
  return fallbackDisplayName?.trim() || "Account holder"
}
