import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseGooglePlaceLocation, parseGoogleRegionPredictions } from "@/lib/maps/google-places-region"

describe("google region predictions", () => {
  it("reads place id and label from autocomplete suggestions", () => {
    const rows = parseGoogleRegionPredictions({
      predictions: [
        { place_id: "ChIJs8i6", description: "Santa Cruz, CA, USA" },
        { place_id: "", description: "Skip" },
      ],
      status: "OK",
    })
    assert.deepEqual(rows, [{ placeId: "ChIJs8i6", label: "Santa Cruz, CA, USA" }])
  })

  it("reads city, state code, and coordinates from a place", () => {
    const place = parseGooglePlaceLocation({
      status: "OK",
      result: {
        formatted_address: "Santa Cruz, CA, USA",
        geometry: { location: { lat: 36.9741, lng: -122.0308 } },
        address_components: [
          { long_name: "Santa Cruz", short_name: "Santa Cruz", types: ["locality", "political"] },
          { long_name: "California", short_name: "CA", types: ["administrative_area_level_1", "political"] },
          { long_name: "United States", short_name: "US", types: ["country", "political"] },
        ],
      },
    })
    assert.deepEqual(place, {
      label: "Santa Cruz, CA, USA",
      lat: 36.9741,
      lng: -122.0308,
      city: "Santa Cruz",
      state: "CA",
    })
  })

  it("rejects a place that has no city", () => {
    assert.equal(
      parseGooglePlaceLocation({
        status: "OK",
        result: {
          formatted_address: "California, USA",
          geometry: { location: { lat: 36.7, lng: -119.4 } },
          address_components: [
            { long_name: "California", short_name: "CA", types: ["administrative_area_level_1"] },
          ],
        },
      }),
      null,
    )
  })
})
