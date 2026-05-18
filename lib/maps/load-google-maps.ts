import { importLibrary, setOptions } from "@googlemaps/js-api-loader"

let loadPromise: Promise<typeof google> | null = null

/**
 * Loads Maps JavaScript API with core `maps` + `places` (singleton). Call only on the client.
 * Loading both libraries before first use avoids incomplete initialization where `places` exists
 * but new Programmatic Autocomplete (`AutocompleteSuggestion`) is missing.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY plus Maps JavaScript API / Places (new) enabled.
 */
export function loadGoogleMapsWithPlaces(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"))
  }
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key?.trim()) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"))
  }
  if (!loadPromise) {
    setOptions({
      key: key.trim(),
      v: "weekly",
    })
    // Load core `maps` before `places` so modular Places + programmatic autocomplete init deterministically.
    loadPromise = importLibrary("maps")
      .then(() => importLibrary("places"))
      .then(() => {
        if (!window.google?.maps?.places) {
          throw new Error("Google Maps Places library failed to load")
        }
        return window.google
      })
  }
  // Clear sticky failure so reopening the message location popover (or a later navigation) can retry.
  return loadPromise.catch((err: unknown) => {
    loadPromise = null
    return Promise.reject(err)
  })
}
