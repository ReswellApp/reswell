import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ReswellSurfMarketplace/1",
} as const

const DEFAULT_TIMEOUT_MS = 8_000

export type UsZipLookupResult = {
  postal_code: string
  city_locality: string
  state_province: string
  address_line1: string
}

/**
 * Resolve a US ZIP to city/state via OpenStreetMap Nominatim (~sub-second).
 * Used for carrier lane rating where a generic street line is sufficient.
 */
export async function lookupUsZipViaNominatim(
  zip5: string,
  opts?: { timeoutMs?: number },
): Promise<UsZipLookupResult | null> {
  const five = zip5.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) return null

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("postalcode", five)
  url.searchParams.set("countrycodes", "us")
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", "1")

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let data: unknown
  try {
    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }

  const first = Array.isArray(data) ? data[0] : null
  const addr =
    first && typeof first === "object" && first !== null && "address" in first
      ? (first as { address?: Record<string, string> }).address
      : undefined

  if (!addr) return null

  const city =
    addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || ""
  const stateRaw = addr.state || ""
  const state = normalizeUsStateProvinceForShipping("US", stateRaw)

  if (!city || !state) return null

  return {
    postal_code: five,
    city_locality: city,
    state_province: state,
    address_line1: "100 Main St",
  }
}
