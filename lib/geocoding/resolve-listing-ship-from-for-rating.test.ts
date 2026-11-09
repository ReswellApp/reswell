import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  pickNominatimCityHit,
  resolveListingShipFromForRating,
} from "./resolve-listing-ship-from-for-rating.ts"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("pickNominatimCityHit", () => {
  it("skips the county hit that has no city", () => {
    const hit = pickNominatimCityHit(
      [
        {
          lat: "34.4458248",
          lon: "-119.0779359",
          address: { county: "Ventura County", state: "California" },
        },
        {
          lat: "34.2783355",
          lon: "-119.2931740",
          address: { city: "Ventura", state: "California", county: "Ventura County" },
        },
      ],
      "Ventura",
    )
    assert.equal(hit?.lat, "34.2783355")
  })
})

describe("resolveListingShipFromForRating", () => {
  it("rates Ventura from the city point when the listing pin is the county centroid", async () => {
    const reversed: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/search")) {
        return jsonResponse([
          {
            lat: "34.2783355",
            lon: "-119.2931740",
            address: { city: "Ventura", state: "California", county: "Ventura County" },
          },
        ])
      }
      reversed.push(url)
      return jsonResponse({
        address: {
          road: "South California Street",
          city: "Ventura",
          state: "California",
          postcode: "93001",
        },
      })
    }) as typeof fetch

    const parts = await resolveListingShipFromForRating({
      city: "Ventura",
      state: "ca",
      latitude: 34.4458248,
      longitude: -119.0779359,
    })

    assert.equal(parts?.postal_code, "93001")
    assert.equal(parts?.city_locality, "Ventura")
    assert.equal(parts?.state_province, "CA")
    assert.equal(parts?.address_line1, "South California Street")
    assert.equal(reversed.length, 1)
    assert.match(reversed[0] ?? "", /lat=34\.2783355/)
    assert.doesNotMatch(reversed[0] ?? "", /34\.4458248/)
  })

  it("keeps the listing city when the pin reverse has a ZIP but no city name", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/search")) return jsonResponse([])
      return jsonResponse({
        address: {
          road: "Santa Paula Canyon Trail",
          state: "California",
          postcode: "93061",
          county: "Ventura County",
        },
      })
    }) as typeof fetch

    const parts = await resolveListingShipFromForRating({
      city: "Ventura",
      state: "ca",
      latitude: 34.4458248,
      longitude: -119.0779359,
    })

    assert.equal(parts?.city_locality, "Ventura")
    assert.equal(parts?.postal_code, "93061")
    assert.equal(parts?.state_province, "CA")
    assert.equal(parts?.address_line1, "Santa Paula Canyon Trail")
  })
})
