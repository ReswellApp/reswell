import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileCategoryListingsQuerySchema } from "@reswell/api-contract"
import { surfboardLocationFilter, surfboardLocationNeedsGeocode } from "./mobileCategoryLocation.ts"

describe("mobile category location", () => {
  it("uses a mile box when a place and radius are set", () => {
    const filter = surfboardLocationFilter(
      { location: "San Diego, CA", lat: 32.7157, lng: -117.1611, radius: "50" },
      null,
    )
    assert.deepEqual(filter.geoBbox, { lat: 32.7157, lng: -117.1611, radiusMiles: 50 })
    assert.equal(filter.locationTextFilter, undefined)
  })

  it("keeps any distance as a city match", () => {
    const filter = surfboardLocationFilter(
      { location: "San Diego, CA", lat: 32.7157, lng: -117.1611 },
      null,
    )
    assert.deepEqual(filter, { locationTextFilter: "San Diego, CA" })
  })

  it("geocodes a typed city only when a radius is set and coordinates are missing", () => {
    assert.equal(
      surfboardLocationNeedsGeocode({ location: "92109", radius: "25" }),
      true,
    )
    assert.equal(
      surfboardLocationNeedsGeocode({ location: "92109", lat: 32.8, lng: -117.2, radius: "25" }),
      false,
    )
    const filter = surfboardLocationFilter({ location: "92109", radius: "25" }, { lat: 32.8, lng: -117.2 })
    assert.deepEqual(filter.geoBbox, { lat: 32.8, lng: -117.2, radiusMiles: 25 })
  })

  it("accepts the website radius values and rejects a radius with no place", () => {
    const parsed = mobileCategoryListingsQuerySchema.parse({
      location: "Encinitas",
      radius: "100",
    })
    assert.equal(parsed.location, "Encinitas")
    assert.equal(parsed.radius, "100")

    const missingPlace = mobileCategoryListingsQuerySchema.safeParse({ radius: "25" })
    assert.equal(missingPlace.success, false)

    const halfPoint = mobileCategoryListingsQuerySchema.safeParse({ lat: "32.7" })
    assert.equal(halfPoint.success, false)
  })
})