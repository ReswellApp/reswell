/// <reference types="google.maps" />

import { mapsPlacesSupportsNewAutocomplete } from "@/lib/maps/places-autocomplete-new"

/** Prefer programmatic (New) autocomplete when the loaded JS supports it; otherwise classic AutocompleteService. */
export function choosePlacesAutocompleteBackend(g: typeof google): "new" | "legacy" {
  if (mapsPlacesSupportsNewAutocomplete(g)) return "new"
  return "legacy"
}

/**
 * Legacy Places AutocompleteService + PlacesService.getDetails.
 * Still works for many production keys that have the classic “Places API” enabled
 * but not the newer programmatic Autocomplete (AutocompleteSuggestion) stack.
 */

export async function legacyFetchAddressPredictions(
  g: typeof google,
  service: google.maps.places.AutocompleteService,
  input: string,
): Promise<{ placeId: string; mainText: string; secondaryText: string }[]> {
  return new Promise((resolve, reject) => {
    service.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: "us" },
        types: ["address"],
      },
      (predictions, status) => {
        if (status === g.maps.places.PlacesServiceStatus.ZERO_RESULTS || !predictions?.length) {
          resolve([])
          return
        }
        if (status !== g.maps.places.PlacesServiceStatus.OK) {
          reject(new Error(`Legacy Places autocomplete: ${status}`))
          return
        }
        resolve(
          predictions.map((p) => ({
            placeId: p.place_id,
            mainText:
              p.structured_formatting?.main_text ??
              p.description.split(",")[0]?.trim() ??
              p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          })),
        )
      },
    )
  })
}

/** City / ZIP / neighborhood style suggestions for listing location. */
export async function legacyFetchRegionPredictions(
  g: typeof google,
  service: google.maps.places.AutocompleteService,
  input: string,
): Promise<{ placeId: string; mainText: string; secondaryText: string }[]> {
  return new Promise((resolve, reject) => {
    const finish = (
      predictions: google.maps.places.AutocompletePrediction[] | null,
      status: google.maps.places.PlacesServiceStatus,
      allowRetry: boolean,
    ) => {
      if (status === g.maps.places.PlacesServiceStatus.ZERO_RESULTS || !predictions?.length) {
        if (allowRetry) {
          service.getPlacePredictions(
            { input, componentRestrictions: { country: "us" } },
            (predictions2, status2) => finish(predictions2, status2, false),
          )
          return
        }
        resolve([])
        return
      }
      if (status !== g.maps.places.PlacesServiceStatus.OK) {
        reject(new Error(`Legacy Places autocomplete: ${status}`))
        return
      }
      resolve(
        predictions.map((p) => ({
          placeId: p.place_id,
          mainText:
            p.structured_formatting?.main_text ??
            p.description.split(",")[0]?.trim() ??
            p.description,
          secondaryText: p.structured_formatting?.secondary_text ?? "",
        })),
      )
    }

    service.getPlacePredictions(
      { input, componentRestrictions: { country: "us" }, types: ["(regions)"] },
      (predictions, status) => finish(predictions, status, true),
    )
  })
}

export async function legacyFetchPlaceDetails(
  g: typeof google,
  placeId: string,
  fields: string[],
): Promise<google.maps.places.PlaceResult | null> {
  const svc = new g.maps.places.PlacesService(document.createElement("div"))
  return new Promise((resolve) => {
    svc.getDetails({ placeId, fields }, (place, status) => {
      if (status !== g.maps.places.PlacesServiceStatus.OK || !place) {
        resolve(null)
        return
      }
      resolve(place)
    })
  })
}
