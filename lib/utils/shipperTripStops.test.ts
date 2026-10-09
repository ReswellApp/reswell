import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { coastalShipperTripSchema } from "../validations/coastal-delivery.ts"

import {
  appendShipperSlot,
  orderRunStopIds,
  orderedShipperPlaces,
  removeShipperSlot,
  shipperStopIdentity,
  sortOrderForLatitude,
  tripStopNames,
} from "./shipperTripStops.ts"

const corridor = [
  { slug: "capitola", name: "Capitola", latitude: 36.971, sortOrder: 10 },
  { slug: "santa-cruz", name: "Santa Cruz", latitude: 36.9647, sortOrder: 20 },
  { slug: "half-moon-bay", name: "Half Moon Bay", latitude: 37.4636, sortOrder: 30 },
  { slug: "pacifica", name: "Pacifica", latitude: 37.6138, sortOrder: 40 },
  { slug: "san-francisco", name: "San Francisco", latitude: 37.7594, sortOrder: 50 },
  { slug: "bolinas", name: "Bolinas", latitude: 37.9094, sortOrder: 60 },
  { slug: "bodega-bay", name: "Bodega Bay", latitude: 38.3332, sortOrder: 70 },
]

describe("shipperStopIdentity", () => {
  it("reuses Capitola and San Francisco instead of creating a second row", () => {
    assert.deepEqual(shipperStopIdentity({ city: "Capitola", state: "CA" }, corridor), {
      mode: "reuse",
      slug: "capitola",
    })
    assert.deepEqual(shipperStopIdentity({ city: "San Francisco", state: "California" }, corridor), {
      mode: "reuse",
      slug: "san-francisco",
    })
  })

  it("names a new Google city with its state", () => {
    assert.deepEqual(shipperStopIdentity({ city: "Los Angeles", state: "CA" }, corridor), {
      mode: "create",
      slug: "los-angeles-ca",
      name: "Los Angeles, CA",
    })
  })
})

describe("sortOrderForLatitude", () => {
  it("puts Santa Barbara south of the corridor and leaves those sort orders alone", () => {
    const slot = sortOrderForLatitude(34.4208, corridor)
    assert.equal(slot.shiftFrom, null)
    assert.ok(slot.sortOrder < 10)
    assert.deepEqual(
      corridor.map((stop) => stop.sortOrder),
      [10, 20, 30, 40, 50, 60, 70],
    )
  })

  it("slots a city between San Francisco and Bolinas", () => {
    const slot = sortOrderForLatitude(37.86, corridor)
    assert.equal(slot.shiftFrom, null)
    assert.ok(slot.sortOrder > 50)
    assert.ok(slot.sortOrder < 60)
  })

  it("shifts the northern neighbor when no integer is free", () => {
    const slot = sortOrderForLatitude(36.5, [
      { latitude: 36, sortOrder: 10 },
      { latitude: 37, sortOrder: 11 },
    ])
    assert.equal(slot.shiftFrom, 11)
    assert.equal(slot.sortOrder, 11)
  })
})

describe("orderRunStopIds", () => {
  it("keeps the drive order even when latitude sort would reverse it", () => {
    const ordered = orderRunStopIds([
      { stopId: "la", position: 0 },
      { stopId: "ventura", position: 1 },
      { stopId: "sb", position: 2 },
    ])
    assert.deepEqual(ordered, {
      stopIds: ["la", "ventura", "sb"],
      stopsInDriveOrder: true,
    })
  })

  it("does not invent drive order when position is missing", () => {
    const ordered = orderRunStopIds([
      { stopId: "bodega-bay", position: null },
      { stopId: "capitola", position: null },
    ])
    assert.equal(ordered.stopsInDriveOrder, false)
    assert.deepEqual(ordered.stopIds, ["bodega-bay", "capitola"])
  })
})

describe("orderedShipperPlaces", () => {
  const from = { key: "from", place: { city: "Santa Barbara", state: "CA", latitude: 34.42, longitude: -119.7, label: "Santa Barbara, CA" } }
  const ventura = { key: "stop-2", place: { city: "Ventura", state: "CA", latitude: 34.27, longitude: -119.29, label: "Ventura, CA" } }
  const to = { key: "to", place: { city: "Los Angeles", state: "CA", latitude: 34.05, longitude: -118.24, label: "Los Angeles, CA" } }

  it("saves From, added stops, and To in drive order", () => {
    const middles = appendShipperSlot([], ventura)
    const places = orderedShipperPlaces([from, ...middles, to])
    assert.deepEqual(
      places?.map((place) => place.city),
      ["Santa Barbara", "Ventura", "Los Angeles"],
    )
  })

  it("does not save while an added stop is empty, and removal clears it", () => {
    const empty = { key: "stop-2", place: null }
    const withEmpty = appendShipperSlot([], empty)
    assert.equal(orderedShipperPlaces([from, ...withEmpty, to]), null)
    assert.deepEqual(
      orderedShipperPlaces([from, ...removeShipperSlot(withEmpty, "stop-2"), to])?.map((place) => place.city),
      ["Santa Barbara", "Los Angeles"],
    )
  })
})

describe("coastalShipperTripSchema", () => {
  const city = (name: string, latitude: number) => ({
    city: name,
    state: "CA",
    latitude,
    longitude: -119,
  })

  it("stores the full ordered city list", () => {
    const parsed = coastalShipperTripSchema.safeParse({
      shipperId: "00000000-0000-4000-8000-000000000001",
      dayOfWeek: 2,
      direction: "northbound",
      enabled: true,
      serviceDate: null,
      stops: [city("Santa Barbara", 34.42), city("Ventura", 34.27), city("Los Angeles", 34.05)],
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.deepEqual(
      parsed.data.stops.map((stop) => stop.city),
      ["Santa Barbara", "Ventura", "Los Angeles"],
    )
  })

  it("rejects a trip with only one city", () => {
    const parsed = coastalShipperTripSchema.safeParse({
      shipperId: "00000000-0000-4000-8000-000000000001",
      dayOfWeek: 2,
      direction: "southbound",
      enabled: true,
      serviceDate: null,
      stops: [city("Santa Barbara", 34.42)],
    })
    assert.equal(parsed.success, false)
  })
})

describe("tripStopNames", () => {
  const stops = [
    { id: "sb", name: "Santa Barbara, CA", sortOrder: -990 },
    { id: "la", name: "Los Angeles, CA", sortOrder: -1990 },
  ]

  it("follows drive order when the trip stored one", () => {
    assert.deepEqual(tripStopNames(["la", "sb"], stops, true), ["Los Angeles, CA", "Santa Barbara, CA"])
  })

  it("falls back to south-to-north for runs saved before drive order", () => {
    assert.deepEqual(tripStopNames(["sb", "la"], stops, false), ["Los Angeles, CA", "Santa Barbara, CA"])
  })
})
