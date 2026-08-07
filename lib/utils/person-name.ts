/** Combines first/last name parts into a display-ready person name. */
export function formatPersonName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "",
): string {
  const parts = [firstName, lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .map(capitalizeFirst)
  return parts.join(" ") || fallback
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
