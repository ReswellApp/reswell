import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DROPOFF_NEARBY_RADIUS_MILES,
  dropoffLocationsNearListing,
  listingOriginIsSet,
  milesBetweenDropoffOrigin,
  parseDropoffNearbyOrigin,
  sellDropoffSectionVisible,
  shouldClearDropoffOnNearbyError,
  shouldClearDropoffWhenOriginGone,
} from "./dropoff-location-nearby.ts"

/** Seeded Santa Barbara drop-off (93101). */
const SANTA_BARBARA_DROPOFF = {
  id: "santa-barbara",
  latitude: 34.4194,
  longitude: -119.7058,
}

const ORIGINS = {
  santaBarbaraZip: { lat: 34.4208, lng: -119.6982 },
  venturaZip: { lat: 34.2805, lng: -119.2945 },
  losAngelesZip: { lat: 34.0522, lng: -118.2437 },
  sanDiegoZip: { lat: 32.7157, lng: -117.1611 },
}

describe("listingOriginIsSet", () => {
  it("is false until a listing pin or ZIP geocode is committed", () => {
    assert.equal(listingOriginIsSet(null, null), false)
    assert.equal(listingOriginIsSet(undefined, undefined), false)
    assert.equal(listingOriginIsSet(0, 0), false)
    assert.equal(listingOriginIsSet(Number.NaN, -119.7), false)
    assert.equal(listingOriginIsSet(ORIGINS.santaBarbaraZip.lat, ORIGINS.santaBarbaraZip.lng), true)
  })
})

describe("parseDropoffNearbyOrigin", () => {
  it("reads lat/lng query params from website and mobile dropoff fetches", () => {
    assert.equal(parseDropoffNearbyOrigin(null, null), null)
    assert.equal(parseDropoffNearbyOrigin("", "-119.7"), null)
    assert.deepEqual(parseDropoffNearbyOrigin("34.4208", "-119.6982"), {
      lat: 34.4208,
      lng: -119.6982,
    })
  })
})

describe("dropoffLocationsNearListing", () => {
  it("hides every city before a listing ZIP/city is entered", () => {
    assert.deepEqual(
      dropoffLocationsNearListing([SANTA_BARBARA_DROPOFF], null, null).map((row) => row.id),
      [],
    )
  })

  it("shows Santa Barbara drop-off for Santa Barbara and Ventura ZIPs", () => {
    const sbMiles = milesBetweenDropoffOrigin(
      ORIGINS.santaBarbaraZip.lat,
      ORIGINS.santaBarbaraZip.lng,
      SANTA_BARBARA_DROPOFF.latitude,
      SANTA_BARBARA_DROPOFF.longitude,
    )
    const venturaMiles = milesBetweenDropoffOrigin(
      ORIGINS.venturaZip.lat,
      ORIGINS.venturaZip.lng,
      SANTA_BARBARA_DROPOFF.latitude,
      SANTA_BARBARA_DROPOFF.longitude,
    )
    assert.ok(sbMiles < 5)
    assert.ok(venturaMiles > 20 && venturaMiles <= DROPOFF_NEARBY_RADIUS_MILES)

    assert.deepEqual(
      dropoffLocationsNearListing(
        [SANTA_BARBARA_DROPOFF],
        ORIGINS.santaBarbaraZip.lat,
        ORIGINS.santaBarbaraZip.lng,
      ).map((row) => row.id),
      ["santa-barbara"],
    )
    assert.deepEqual(
      dropoffLocationsNearListing(
        [SANTA_BARBARA_DROPOFF],
        ORIGINS.venturaZip.lat,
        ORIGINS.venturaZip.lng,
      ).map((row) => row.id),
      ["santa-barbara"],
    )
  })

  it("keeps drop-off hidden for Los Angeles and San Diego ZIPs", () => {
    const laMiles = milesBetweenDropoffOrigin(
      ORIGINS.losAngelesZip.lat,
      ORIGINS.losAngelesZip.lng,
      SANTA_BARBARA_DROPOFF.latitude,
      SANTA_BARBARA_DROPOFF.longitude,
    )
    assert.ok(laMiles > DROPOFF_NEARBY_RADIUS_MILES)

    assert.deepEqual(
      dropoffLocationsNearListing(
        [SANTA_BARBARA_DROPOFF],
        ORIGINS.losAngelesZip.lat,
        ORIGINS.losAngelesZip.lng,
      ),
      [],
    )
    assert.deepEqual(
      dropoffLocationsNearListing(
        [SANTA_BARBARA_DROPOFF],
        ORIGINS.sanDiegoZip.lat,
        ORIGINS.sanDiegoZip.lng,
      ),
      [],
    )
  })

  it("skips a drop-off site that has no coordinates", () => {
    assert.deepEqual(
      dropoffLocationsNearListing(
        [{ id: "unknown", latitude: null, longitude: null }],
        ORIGINS.santaBarbaraZip.lat,
        ORIGINS.santaBarbaraZip.lng,
      ),
      [],
    )
  })
})

describe("sellDropoffSectionVisible", () => {
  it("stays hidden until a nearby city is ready to display", () => {
    assert.equal(
      sellDropoffSectionVisible({
        listingLat: null,
        listingLng: null,
        nearbyCount: 1,
      }),
      false,
    )
    assert.equal(
      sellDropoffSectionVisible({
        listingLat: ORIGINS.losAngelesZip.lat,
        listingLng: ORIGINS.losAngelesZip.lng,
        nearbyCount: 0,
      }),
      false,
    )
    assert.equal(
      sellDropoffSectionVisible({
        listingLat: ORIGINS.venturaZip.lat,
        listingLng: ORIGINS.venturaZip.lng,
        nearbyCount: 1,
      }),
      true,
    )
  })

  it("still shows the section so a nearby seller can retry a failed load", () => {
    assert.equal(
      sellDropoffSectionVisible({
        listingLat: ORIGINS.santaBarbaraZip.lat,
        listingLng: ORIGINS.santaBarbaraZip.lng,
        nearbyCount: 0,
        loadError: true,
      }),
      true,
    )
  })
})

describe("shouldClearDropoffOnNearbyError", () => {
  it("keeps a restored pack-and-ship choice when the first nearby fetch fails", () => {
    assert.equal(
      shouldClearDropoffOnNearbyError({
        loadedOriginKey: "",
        currentOriginKey: "34.42080,-119.69820",
      }),
      false,
    )
  })

  it("clears drop-off after a confirmed origin moves and the new fetch fails", () => {
    assert.equal(
      shouldClearDropoffOnNearbyError({
        loadedOriginKey: "34.42080,-119.69820",
        currentOriginKey: "34.05220,-118.24370",
      }),
      true,
    )
  })

  it("keeps drop-off when retrying the same confirmed origin fails", () => {
    assert.equal(
      shouldClearDropoffOnNearbyError({
        loadedOriginKey: "34.42080,-119.69820",
        currentOriginKey: "34.42080,-119.69820",
      }),
      false,
    )
  })
})

describe("shouldClearDropoffWhenOriginGone", () => {
  it("keeps a restored pack-and-ship choice until listing pins hydrate", () => {
    assert.equal(
      shouldClearDropoffWhenOriginGone({
        originReady: false,
        loadedOriginKey: "",
      }),
      false,
    )
  })

  it("clears drop-off after a confirmed origin is removed", () => {
    assert.equal(
      shouldClearDropoffWhenOriginGone({
        originReady: false,
        loadedOriginKey: "34.42080,-119.69820",
      }),
      true,
    )
  })

  it("does not clear while a confirmed origin is still present", () => {
    assert.equal(
      shouldClearDropoffWhenOriginGone({
        originReady: true,
        loadedOriginKey: "34.42080,-119.69820",
      }),
      false,
    )
  })
})
