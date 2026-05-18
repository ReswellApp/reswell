/// <reference types="google.maps" />

/**
 * Maps JavaScript API — Places (new) programmatic autocomplete helpers.
 * @types/google.maps often lags; keep runtime-compatible shapes narrow.
 */

/** Corresponds roughly to legacy `types: ["(regions)")]`, max 5 primary types per request. */
export const AUTOCOMPLETE_US_REGION_PRIMARY_TYPES = [
  "locality",
  "postal_code",
  "administrative_area_level_1",
  "administrative_area_level_3",
  "neighborhood",
] as const

/** Address-style suggestions (matches `included-primary-types="street_address"` examples). */
export const AUTOCOMPLETE_US_ADDRESS_PRIMARY_TYPES = ["street_address"] as const

type FormattableText = {
  readonly text?: string
}

/** Minimal handle for resolving details via {@link google.maps.places.Place.fetchFields}. */
export type PlacePredictionHandle = {
  readonly placeId: string
  toPlace(): google.maps.places.Place
}

/** One element from `AutocompleteSuggestion.fetchAutocompleteSuggestions` results. */
export type AutocompleteSuggestionItem = {
  readonly placePrediction?: PlacePredictionHandle
}

type PlacesLibWithNewAutocomplete = typeof google.maps.places & {
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (req: Record<string, unknown>) => Promise<{
      suggestions: AutocompleteSuggestionItem[]
    }>
  }
  AutocompleteSessionToken?: new () => google.maps.places.AutocompleteSessionToken
}

export function mapsPlacesSupportsNewAutocomplete(g: typeof google): boolean {
  const p = g.maps.places as PlacesLibWithNewAutocomplete
  return typeof p.AutocompleteSuggestion?.fetchAutocompleteSuggestions === "function"
}

export function createAutocompleteSessionToken(
  g: typeof google,
): google.maps.places.AutocompleteSessionToken | undefined {
  const Ctor = (g.maps.places as PlacesLibWithNewAutocomplete).AutocompleteSessionToken
  if (typeof Ctor !== "function") return undefined
  return new Ctor()
}

export async function fetchAutocompletePlacePredictions(
  g: typeof google,
  request: Record<string, unknown>,
): Promise<readonly AutocompleteSuggestionItem[]> {
  const fetchFn = (g.maps.places as PlacesLibWithNewAutocomplete).AutocompleteSuggestion
    ?.fetchAutocompleteSuggestions
  if (typeof fetchFn !== "function") {
    throw new Error("AutocompleteSuggestion.fetchAutocompleteSuggestions is not available")
  }
  const { suggestions } = await fetchFn(request)
  return suggestions ?? []
}

export function suggestionToRowTexts(s: AutocompleteSuggestionItem): {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
  prediction: PlacePredictionHandle
} | null {
  const prediction = s.placePrediction
  if (!prediction?.placeId || typeof prediction.toPlace !== "function") return null
  const pt = prediction as PlacePredictionHandle & {
    readonly text?: FormattableText
    readonly mainText?: FormattableText | null
    readonly secondaryText?: FormattableText | null
  }
  const full = pt.text?.text?.trim() ?? ""
  const main = pt.mainText?.text?.trim() ?? (full.split(",")[0]?.trim() ?? full)
  const secondary = pt.secondaryText?.text?.trim() ?? ""
  const description = full || [main, secondary].filter(Boolean).join(", ")
  return {
    placeId: prediction.placeId,
    description,
    mainText: main || description,
    secondaryText: secondary,
    prediction,
  }
}

/** New `Place.addressComponents` entries use longText/shortText; legacy parser expects Geocoder-shaped components. */
export function newPlaceAddressComponentsToGeocoder(
  components: google.maps.places.AddressComponent[] | null | undefined,
): google.maps.GeocoderAddressComponent[] {
  if (!components?.length) return []
  return components.map((c) => ({
    long_name: c.longText ?? "",
    short_name: c.shortText ?? "",
    types: c.types ?? [],
  }))
}

/** Reads location from Places (new) `Place.location` whether LatLng or literal. */
export function readPlaceLocationLatLng(place: {
  readonly location?:
    | google.maps.LatLng
    | google.maps.LatLngLiteral
    | { lat(): number; lng(): number }
    | null
}): { lat: number; lng: number } | null {
  const loc = place.location
  if (!loc) return null
  if (typeof (loc as google.maps.LatLng).lat === "function") {
    const ll = loc as google.maps.LatLng
    return { lat: ll.lat(), lng: ll.lng() }
  }
  const literal = loc as google.maps.LatLngLiteral
  if (typeof literal.lat === "number" && typeof literal.lng === "number") {
    return { lat: literal.lat, lng: literal.lng }
  }
  return null
}
