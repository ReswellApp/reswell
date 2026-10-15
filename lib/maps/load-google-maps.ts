import { importLibrary, setOptions } from "@googlemaps/js-api-loader"

let mapsPromise: Promise<typeof google> | null = null
let placesPromise: Promise<typeof google> | null = null

function browserOnly(): Promise<never> | null {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"))
  }
  return null
}

function mapsApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set")
  return key
}

/**
 * Loads the Maps JavaScript API (singleton). Call only on the client.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and the Maps JavaScript API.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  const blocked = browserOnly()
  if (blocked) return blocked
  if (!mapsPromise) {
    let key: string
    try {
      key = mapsApiKey()
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"))
    }
    setOptions({ key, v: "weekly" })
    mapsPromise = importLibrary("maps").then(() => {
      if (!window.google?.maps) throw new Error("Google Maps failed to load")
      return window.google
    })
  }
  return mapsPromise.catch((err: unknown) => {
    mapsPromise = null
    placesPromise = null
    return Promise.reject(err)
  })
}

/**
 * Loads Maps JavaScript API with core `maps` + `places` (singleton). Call only on the client.
 * Loading both libraries before first use avoids incomplete initialization where `places` exists
 * but new Programmatic Autocomplete (`AutocompleteSuggestion`) is missing.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY plus Maps JavaScript API / Places (new) enabled.
 */
export function loadGoogleMapsWithPlaces(): Promise<typeof google> {
  const blocked = browserOnly()
  if (blocked) return blocked
  if (!placesPromise) {
    placesPromise = loadGoogleMaps()
      .then(() => importLibrary("places"))
      .then(() => {
        if (!window.google?.maps?.places) {
          throw new Error("Google Maps Places library failed to load")
        }
        return window.google
      })
  }
  // Clear sticky failure so reopening the message location popover (or a later navigation) can retry.
  return placesPromise.catch((err: unknown) => {
    placesPromise = null
    return Promise.reject(err)
  })
}
