import { importLibrary, setOptions } from "@googlemaps/js-api-loader"

let loadPromise: Promise<typeof google> | null = null

/**
 * Loads Maps JavaScript API with Places (singleton). Call only on the client.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and Places API enabled for the key.
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
    loadPromise = importLibrary("places").then(() => {
      if (!window.google?.maps?.places) {
        throw new Error("Google Maps Places library failed to load")
      }
      return window.google
    })
  }
  return loadPromise
}
