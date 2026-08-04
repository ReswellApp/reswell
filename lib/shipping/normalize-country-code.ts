/**
 * ShipEngine requires ISO 3166-1 alpha-2 (`US`). Checkout / geocoders often store
 * full names like "United States" or "UNITED STATES".
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  us: "US",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "u.s.a": "US",
  "united states": "US",
  "united states of america": "US",
  "united states of america (the)": "US",
  america: "US",
}

/**
 * Normalize a country field to a 2-letter ISO code for ShipEngine rate/label APIs.
 * Unknown values that are already 2 letters are uppercased; other unknowns fall back to US
 * when they look like a US name variant, otherwise pass through uppercased (trimmed).
 */
export function normalizeCountryCodeForShipping(country: string | null | undefined): string {
  const raw = (country ?? "").trim()
  if (!raw) return "US"

  const upper = raw.toUpperCase()
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper
  }

  const mapped = COUNTRY_NAME_TO_CODE[raw.toLowerCase()]
  if (mapped) return mapped

  // e.g. "UNITED STATES" after toLowerCase maps above; keep defensive US fallback for common drift
  if (upper.includes("UNITED STATES") || upper === "USA" || upper === "U.S.A.") {
    return "US"
  }

  // Already a plausible alpha-2 with junk? Prefer first two letters only if the whole string is 2 chars.
  return upper.length === 2 ? upper : upper
}
