import {
  isUspsStateProvinceCode,
  US_STATE_NAME_TO_CODE,
} from "@/lib/us-state-name-to-code"

/**
 * Marketplace-style location chip: "Los Angeles, CA".
 * Empty input stays "Location".
 */
export function boardsBrowseLocationButtonLabel(location: string): string {
  const trimmed = location.trim()
  if (!trimmed) return "Location"
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  const city = parts[0]
  if (!city) return "Location"
  const region = parts[1]
  if (!region) return city
  const code = isUspsStateProvinceCode(region)
    ? region.toUpperCase()
    : US_STATE_NAME_TO_CODE[region.toLowerCase()]
  return code ? `${city}, ${code}` : `${city}, ${region}`
}
