import { normalizeCountryCodeForShipping } from "@/lib/shipping/normalize-country-code"

/**
 * Maps Google Places `address_components` to ShipEngine-style shipping fields.
 * Accepts legacy Geocoder components and the Places (new) longText/shortText shape
 * after {@link newPlaceAddressComponentsToGeocoder}.
 */
export type ParsedGoogleShippingAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

export type GoogleAddressComponentInput = {
  long_name?: string | null
  short_name?: string | null
  types?: readonly string[] | null
}

function componentText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (value && typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text
    if (typeof text === "string") return text.trim()
  }
  return ""
}

function componentTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

/**
 * Places (new) `Place.addressComponents` use longText/shortText.
 * Some Maps JS builds still expose long_name/short_name, or wrap the text.
 * Empty rows are dropped so a failed mapping does not look like a resolved street.
 */
export function newPlaceAddressComponentsToGeocoder(
  components: readonly unknown[] | null | undefined,
): GoogleAddressComponentInput[] {
  if (!components?.length) return []
  const out: GoogleAddressComponentInput[] = []
  for (const entry of components) {
    if (!entry || typeof entry !== "object") continue
    const raw = entry as Record<string, unknown>
    const long_name =
      componentText(raw.longText) || componentText(raw.long_name) || componentText(raw.longName)
    const short_name =
      componentText(raw.shortText) || componentText(raw.short_name) || componentText(raw.shortName)
    if (!long_name && !short_name) continue
    out.push({
      long_name,
      short_name: short_name || long_name,
      types: componentTypes(raw.types),
    })
  }
  return out
}

export function parseGoogleAddressComponents(
  components: readonly GoogleAddressComponentInput[],
): ParsedGoogleShippingAddress {
  const get = (type: string, short = false) => {
    const c = components.find((x) => (x.types ?? []).includes(type))
    if (!c) return ""
    const longName = c.long_name?.trim() ?? ""
    const shortName = c.short_name?.trim() ?? ""
    if (short) return shortName || longName
    return longName || shortName
  }

  const streetNumber = get("street_number")
  const route = get("route")
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim()

  const subpremise = get("subpremise")
  const premise = get("premise")
  const line2 = [subpremise, premise].filter(Boolean).join(" ").trim()

  // administrative_area_level_2 is county — used when Google omits locality for a ZIP.
  const county = get("administrative_area_level_2").replace(/\s+County$/i, "").trim()
  const city =
    get("locality") ||
    get("postal_town") ||
    get("sublocality_level_1") ||
    get("sublocality") ||
    get("neighborhood") ||
    get("administrative_area_level_3") ||
    county ||
    ""

  const state = get("administrative_area_level_1", true)
  const postal_code = get("postal_code")
  const countryRaw = get("country", true) || "US"
  const normalizedCountry = normalizeCountryCodeForShipping(countryRaw)
  const country = /^[A-Z]{2}$/.test(normalizedCountry) ? normalizedCountry : "US"

  return { line1, line2, city, state, postal_code, country }
}
