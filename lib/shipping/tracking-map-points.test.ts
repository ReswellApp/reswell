import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  trackingMapPointsFromEvents,
  trackingMapSummary,
} from "./tracking-map-points.ts"

describe("trackingMapPointsFromEvents", () => {
  it("keeps unique stops oldest-first from newest-first scan events", () => {
    const points = trackingMapPointsFromEvents([
      { city_locality: "CAPE ELIZABETH", state_province: "ME", latitude: 43.56, longitude: -70.2 },
      { city_locality: "PORTLAND", state_province: "ME", latitude: 43.66, longitude: -70.25 },
      { city_locality: "SANTA BARBARA", state_province: "CA", latitude: 34.42, longitude: -119.7 },
      { city_locality: "SANTA BARBARA", state_province: "CA", latitude: 34.42, longitude: -119.7 },
    ])
    assert.deepEqual(
      points.map((point) => point.label),
      ["SANTA BARBARA, CA", "PORTLAND, ME", "CAPE ELIZABETH, ME"],
    )
    assert.equal(trackingMapSummary(points), "SANTA BARBARA, CA → CAPE ELIZABETH, ME")
  })

  it("skips scans that have no coordinates", () => {
    const points = trackingMapPointsFromEvents([
      { city_locality: "PORTLAND", state_province: "ME" },
      { city_locality: "SANTA BARBARA", state_province: "CA", latitude: 34.42, longitude: -119.7 },
    ])
    assert.equal(points.length, 1)
    assert.equal(points[0]?.label, "SANTA BARBARA, CA")
  })
})
