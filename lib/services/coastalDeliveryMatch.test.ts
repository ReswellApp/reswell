import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { CoastalStopView } from "@/lib/types/coastal-delivery.ts"
import {
  matchCoastalShippers,
  nextRunDateIso,
  pacificWeekDateIso,
  suggestPickupStopId,
  type CoastalMatchShipper,
} from "./coastalDeliveryMatch.ts"

const stops = {
  capitola: { id: "capitola", sortOrder: 10 },
  santaCruz: { id: "santa-cruz", sortOrder: 20 },
  sanFrancisco: { id: "san-francisco", sortOrder: 50 },
  bodega: { id: "bodega-bay", sortOrder: 70 },
}

const corridorStops: CoastalStopView[] = [
  { id: "capitola", slug: "capitola", name: "Capitola", sortOrder: 10 },
  { id: "santa-cruz", slug: "santa-cruz", name: "Santa Cruz", sortOrder: 20 },
  { id: "san-francisco", slug: "san-francisco", name: "San Francisco", sortOrder: 50 },
]

function shipper(overrides: Partial<CoastalMatchShipper> = {}): CoastalMatchShipper {
  return {
    shipperId: "shipper-a",
    displayName: "Avery",
    scheduleEnabled: true,
    runs: [
      {
        id: "run-tue-north",
        dayOfWeek: 2,
        direction: "northbound",
        enabled: true,
        stopIds: ["santa-cruz", "san-francisco", "bodega-bay"],
      },
    ],
    ...overrides,
  }
}

const mondayPacific = new Date("2026-10-05T18:00:00.000Z")

describe("nextRunDateIso", () => {
  it("includes today when the weekday matches Pacific time", () => {
    assert.equal(nextRunDateIso(mondayPacific, 1), "2026-10-05")
  })

  it("rolls to the next Pacific weekday", () => {
    assert.equal(nextRunDateIso(mondayPacific, 2), "2026-10-06")
    assert.equal(nextRunDateIso(mondayPacific, 0), "2026-10-11")
  })

  it("uses the Pacific calendar when UTC has already moved to the next day", () => {
    const stillSundayPacific = new Date("2026-10-05T06:30:00.000Z")
    assert.equal(nextRunDateIso(stillSundayPacific, 0), "2026-10-04")
    assert.equal(nextRunDateIso(stillSundayPacific, 1), "2026-10-05")
  })
})

describe("pacificWeekDateIso", () => {
  it("uses the Sunday-through-Saturday week in Pacific time", () => {
    assert.equal(pacificWeekDateIso(mondayPacific, 0), "2026-10-04")
    assert.equal(pacificWeekDateIso(mondayPacific, 1), "2026-10-05")
    assert.equal(pacificWeekDateIso(mondayPacific, 6), "2026-10-10")
  })
})

describe("suggestPickupStopId", () => {
  it("matches a listing city to a corridor stop", () => {
    assert.equal(suggestPickupStopId("Santa Cruz", corridorStops), "santa-cruz")
    assert.equal(suggestPickupStopId("  san francisco ", corridorStops), "san-francisco")
  })

  it("returns null when the seller city is off the corridor", () => {
    assert.equal(suggestPickupStopId("Los Angeles", corridorStops), null)
    assert.equal(suggestPickupStopId(null, corridorStops), null)
  })
})

describe("matchCoastalShippers", () => {
  it("returns the soonest enabled run that covers both stops northbound", () => {
    const result = matchCoastalShippers({
      pickup: stops.santaCruz,
      dropoff: stops.sanFrancisco,
      shippers: [
        shipper({
          runs: [
            {
              id: "run-fri",
              dayOfWeek: 5,
              direction: "northbound",
              enabled: true,
              stopIds: ["santa-cruz", "san-francisco"],
            },
            {
              id: "run-tue",
              dayOfWeek: 2,
              direction: "northbound",
              enabled: true,
              stopIds: ["capitola", "santa-cruz", "san-francisco"],
            },
            {
              id: "run-south",
              dayOfWeek: 1,
              direction: "southbound",
              enabled: true,
              stopIds: ["santa-cruz", "san-francisco"],
            },
          ],
        }),
      ],
      now: mondayPacific,
    })

    assert.equal(result.reason, "ok")
    assert.equal(result.matches.length, 1)
    assert.equal(result.matches[0]?.runId, "run-tue")
    assert.equal(result.matches[0]?.nextRunOn, "2026-10-06")
    assert.equal(result.matches[0]?.direction, "northbound")
  })

  it("matches southbound only when the drop-off is further south", () => {
    const result = matchCoastalShippers({
      pickup: stops.sanFrancisco,
      dropoff: stops.santaCruz,
      shippers: [shipper()],
      now: mondayPacific,
    })
    assert.equal(result.reason, "no_route_match")

    const south = matchCoastalShippers({
      pickup: stops.bodega,
      dropoff: stops.capitola,
      shippers: [
        shipper({
          runs: [
            {
              id: "run-south",
              dayOfWeek: 4,
              direction: "southbound",
              enabled: true,
              stopIds: ["capitola", "bodega-bay"],
            },
          ],
        }),
      ],
      now: mondayPacific,
    })
    assert.equal(south.reason, "ok")
    assert.equal(south.matches[0]?.runId, "run-south")
  })

  it("reports schedules off when a covering run or the whole schedule is disabled", () => {
    const runOff = matchCoastalShippers({
      pickup: stops.santaCruz,
      dropoff: stops.sanFrancisco,
      shippers: [
        shipper({
          runs: [
            {
              id: "run-off",
              dayOfWeek: 2,
              direction: "northbound",
              enabled: false,
              stopIds: ["santa-cruz", "san-francisco"],
            },
          ],
        }),
      ],
      now: mondayPacific,
    })
    assert.equal(runOff.reason, "schedules_off")

    const scheduleOff = matchCoastalShippers({
      pickup: stops.santaCruz,
      dropoff: stops.sanFrancisco,
      shippers: [shipper({ scheduleEnabled: false })],
      now: mondayPacific,
    })
    assert.equal(scheduleOff.reason, "schedules_off")
  })

  it("reports empty, same-stop, and no-route states", () => {
    assert.equal(
      matchCoastalShippers({
        pickup: stops.santaCruz,
        dropoff: stops.sanFrancisco,
        shippers: [],
        now: mondayPacific,
      }).reason,
      "no_shippers",
    )
    assert.equal(
      matchCoastalShippers({
        pickup: stops.santaCruz,
        dropoff: stops.santaCruz,
        shippers: [shipper()],
        now: mondayPacific,
      }).reason,
      "same_stop",
    )
    assert.equal(
      matchCoastalShippers({
        pickup: stops.capitola,
        dropoff: stops.santaCruz,
        shippers: [shipper()],
        now: mondayPacific,
      }).reason,
      "no_route_match",
    )
  })

  it("keeps an active shipper when another covering schedule is off", () => {
    const result = matchCoastalShippers({
      pickup: stops.santaCruz,
      dropoff: stops.sanFrancisco,
      shippers: [
        shipper({ shipperId: "off", displayName: "Off", scheduleEnabled: false }),
        shipper({ shipperId: "on", displayName: "On" }),
      ],
      now: mondayPacific,
    })
    assert.equal(result.reason, "ok")
    assert.equal(result.matches[0]?.shipperId, "on")
  })

  it("orders shippers by the next run date", () => {
    const result = matchCoastalShippers({
      pickup: stops.santaCruz,
      dropoff: stops.sanFrancisco,
      shippers: [
        shipper({
          shipperId: "later",
          displayName: "Later",
          runs: [
            {
              id: "run-sat",
              dayOfWeek: 6,
              direction: "northbound",
              enabled: true,
              stopIds: ["santa-cruz", "san-francisco"],
            },
          ],
        }),
        shipper({
          shipperId: "sooner",
          displayName: "Sooner",
          runs: [
            {
              id: "run-mon",
              dayOfWeek: 1,
              direction: "northbound",
              enabled: true,
              stopIds: ["santa-cruz", "san-francisco"],
            },
          ],
        }),
      ],
      now: mondayPacific,
    })
    assert.deepEqual(
      result.matches.map((match) => match.shipperId),
      ["sooner", "later"],
    )
  })
})
