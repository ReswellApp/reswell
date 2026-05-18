/// <reference types="google.maps" />

import { importLibrary } from "@googlemaps/js-api-loader"

/**
 * Maps JavaScript API — Places (new) programmatic autocomplete helpers.
 * @types/google.maps often lags; keep runtime-compatible shapes narrow.
 */

/** Corresponds roughly to legacy `types: ["(regions)")]`, max 5 primary types per request. */
export const AUTOCOMPLETE_US_REGION_PRIMARY_TYPES = [
  "locality",
  "postal_code",
  "administrative_area_level_1",
  "neighborhood",
  "sublocality",
] as const

/**
 * Street-level address suggestions for the new Autocomplete API.
 * `street_address` alone is too narrow (many valid US addresses are typed `premise` / `subpremise`).
 */
export const AUTOCOMPLETE_US_ADDRESS_PRIMARY_TYPES = [
  "premise",
  "subpremise",
  "street_address",
] as const

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
  Place?: new (opts: { id: string }) => google.maps.places.Place
}

function getFetchAutocompleteFromPlacesLib(lib: PlacesLibWithNewAutocomplete) {
  return lib.AutocompleteSuggestion?.fetchAutocompleteSuggestions
}

export function mapsPlacesSupportsNewAutocomplete(g: typeof google): boolean {
  const p = g.maps.places as PlacesLibWithNewAutocomplete
  return typeof getFetchAutocompleteFromPlacesLib(p) === "function"
}

export function createAutocompleteSessionToken(
  g: typeof google,
): google.maps.places.AutocompleteSessionToken | undefined {
  const lib = g.maps.places as PlacesLibWithNewAutocomplete
  const Ctor = lib.AutocompleteSessionToken
  if (typeof Ctor !== "function") return undefined
  return new Ctor()
}

/** Reads `FormattableText` or plain strings from prediction fields (API surface varies by build). */
function readFormattableTextLike(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "object" && value !== null && "text" in value) {
    const t = (value as { text?: unknown }).text
    if (typeof t === "string") return t.trim()
  }
  return ""
}

function toPlaceFromId(placeId: string): google.maps.places.Place {
  const PlaceCtor = (window.google?.maps?.places as PlacesLibWithNewAutocomplete | undefined)?.Place
  if (typeof PlaceCtor !== "function") {
    throw new Error("google.maps.places.Place is not available")
  }
  return new PlaceCtor({ id: placeId })
}

async function resolveFetchAutocompleteSuggestions(
  g: typeof google,
): Promise<
  (req: Record<string, unknown>) => Promise<{ suggestions: AutocompleteSuggestionItem[] }>
> {
  const onNamespace = getFetchAutocompleteFromPlacesLib(g.maps.places as PlacesLibWithNewAutocomplete)
  if (typeof onNamespace === "function") return onNamespace

  const fromImport = getFetchAutocompleteFromPlacesLib(
    (await importLibrary("places")) as unknown as PlacesLibWithNewAutocomplete,
  )
  if (typeof fromImport === "function") return fromImport

  throw new Error("AutocompleteSuggestion.fetchAutocompleteSuggestions is not available")
}

export async function fetchAutocompletePlacePredictions(
  g: typeof google,
  request: Record<string, unknown>,
): Promise<readonly AutocompleteSuggestionItem[]> {
  const fetchFn = await resolveFetchAutocompleteSuggestions(g)
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
  if (!prediction) return null

  const rawId = prediction.placeId
  const placeId = typeof rawId === "string" ? rawId.trim() : ""
  if (!placeId) return null

  const pt = prediction as PlacePredictionHandle & {
    readonly text?: unknown
    readonly mainText?: unknown | null
    readonly secondaryText?: unknown | null
    toPlace?: () => google.maps.places.Place
  }

  const full = readFormattableTextLike(pt.text)
  const mainRaw = readFormattableTextLike(pt.mainText)
  const main = mainRaw || full.split(",")[0]?.trim() || full
  const secondary = readFormattableTextLike(pt.secondaryText)
  const description = full || [main, secondary].filter(Boolean).join(", ")

  const toPlace =
    typeof pt.toPlace === "function"
      ? () => pt.toPlace!.call(pt)
      : () => toPlaceFromId(placeId)

  return {
    placeId,
    description,
    mainText: main || description,
    secondaryText: secondary,
    prediction: {
      placeId,
      toPlace,
    },
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
