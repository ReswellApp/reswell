import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  addressSnapshotsEqual,
  canSetCoastalStatus,
  chooseCoastalSale,
  mergeAddressSnapshot,
  snapshotFromListingPin,
  snapshotFromOrderShipping,
  type CoastalSaleOrder,
} from "./coastalAddressSnapshot"
import {
  authorizeCoastalShipperView,
  coastalJobVisibleToShipper,
  coastalShipperMembership,
  resolveCoastalShipperGrantUserId,
} from "./coastalShipperAccess"
import { shipperAccountLine, shipperServesPoint, shipperWeekStatusLine, soonestEnabledTrip, tripsForWeek } from "./coastalShipperWeek"
import { buildCoastalRunSheet, type CoastalJobDraft } from "./coastalShipperRunSheet"
import type { CoastalAddressSnapshot, CoastalRunView, CoastalStopView } from "@/lib/types/coastal-delivery"

const mondayPacific = new Date("2026-10-05T18:00:00.000Z")

const stops: CoastalStopView[] = [
  { id: "capitola", slug: "capitola", name: "Capitola", sortOrder: 10 },
  { id: "santa-cruz", slug: "santa-cruz", name: "Santa Cruz", sortOrder: 20 },
  { id: "san-francisco", slug: "san-francisco", name: "San Francisco", sortOrder: 50 },
  { id: "bodega-bay", slug: "bodega-bay", name: "Bodega Bay", sortOrder: 70 },
]

describe("coastalShipperMembership", () => {
  it("is a coastal_shippers row, not schedule, admin, or a run", () => {
    assert.equal(coastalShipperMembership({ rowId: "shipper-1", queryFailed: false }), true)
    assert.equal(coastalShipperMembership({ rowId: "", queryFailed: false }), false)
    assert.equal(coastalShipperMembership({ rowId: null, queryFailed: false }), false)
    assert.equal(coastalShipperMembership({ rowId: "shipper-1", queryFailed: true }), false)
  })
})

describe("resolveCoastalShipperGrantUserId", () => {
  it("uses the profile id, then the auth login id", () => {
    assert.deepEqual(resolveCoastalShipperGrantUserId({ profileIds: ["profile-1"], authUserId: "auth-1" }), {
      userId: "profile-1",
    })
    assert.deepEqual(resolveCoastalShipperGrantUserId({ profileIds: [], authUserId: "auth-1" }), {
      userId: "auth-1",
    })
    assert.deepEqual(resolveCoastalShipperGrantUserId({ profileIds: [], authUserId: null }), {
      error: "No Reswell account uses that email.",
    })
    assert.deepEqual(
      resolveCoastalShipperGrantUserId({ profileIds: ["a", "b"], authUserId: "auth-1" }),
      { error: "More than one account uses that email." },
    )
  })
})

describe("shipperWeekStatusLine", () => {
  it("says the service state once", () => {
    assert.equal(shipperWeekStatusLine({ scheduleEnabled: false, runs: [] }), "Shipper is off.")
    assert.equal(shipperWeekStatusLine({ scheduleEnabled: true, runs: [] }), "Shipper is on.")
    assert.equal(
      shipperWeekStatusLine({ scheduleEnabled: true, runs: [{ enabled: true }] }),
      "Shipper is on. One run can take boards.",
    )
    assert.equal(shipperAccountLine({ email: "haydensbsb@gmail.com", isShop: true }), "haydensbsb@gmail.com · Shop")
  })
})

describe("tripsForWeek", () => {
  it("lets a dated trip replace the weekly one for that day", () => {
    const weekly = {
      id: "weekly",
      dayOfWeek: 2,
      direction: "northbound" as const,
      enabled: true,
      stopIds: ["a", "b"],
      serviceDate: null,
    }
    const dated = { ...weekly, id: "dated", serviceDate: "2026-10-06" }
    const shown = tripsForWeek([weekly, dated], "2026-10-04")
    assert.deepEqual(shown.map((trip) => trip.id), ["dated"])
    assert.equal(shipperServesPoint({
      latitude: 36.97,
      city: "Santa Cruz",
      line1: "1 Pacific Ave",
      regionLatitudes: [36.97, 37.76],
      exclusions: ["Oakland"],
    }), true)
    assert.equal(shipperServesPoint({
      latitude: 34.42,
      city: "Santa Barbara",
      line1: "1 State St",
      regionLatitudes: [36.97, 37.76],
      exclusions: [],
    }), false)
  })
})

describe("soonestEnabledTrip", () => {
  const monday = new Date("2026-06-15T18:00:00.000Z")
  const weekly = {
    id: "weekly",
    dayOfWeek: 2,
    direction: "northbound" as const,
    enabled: true,
    serviceDate: null,
  }

  it("uses a one-week trip on its date and skips a week that trip is off", () => {
    const dated = { ...weekly, id: "dated", serviceDate: "2026-06-16" }
    assert.equal(soonestEnabledTrip(monday, [weekly, dated])?.run.id, "dated")
    assert.equal(soonestEnabledTrip(monday, [weekly, dated])?.date, "2026-06-16")

    const cancelled = { ...dated, enabled: false }
    const skipped = soonestEnabledTrip(monday, [weekly, cancelled])
    assert.equal(skipped?.run.id, "weekly")
    assert.equal(skipped?.date, "2026-06-23")

    const past = { ...dated, serviceDate: "2026-06-09" }
    assert.equal(soonestEnabledTrip(monday, [past]), null)
  })
})

describe("authorizeCoastalShipperView", () => {
  it("lets the shipper and an admin through, and hides everyone else", () => {
    assert.equal(authorizeCoastalShipperView({ userId: null, isAdmin: false, shipperUserId: "owner" }), "not_found")
    assert.equal(authorizeCoastalShipperView({ userId: "buyer", isAdmin: false, shipperUserId: null }), "not_found")
    assert.equal(authorizeCoastalShipperView({ userId: "employee", isAdmin: false, shipperUserId: "owner" }), "not_found")
    assert.equal(authorizeCoastalShipperView({ userId: "owner", isAdmin: false, shipperUserId: "owner" }), "allow")
    assert.equal(authorizeCoastalShipperView({ userId: "admin", isAdmin: true, shipperUserId: "owner" }), "allow")
    assert.equal(authorizeCoastalShipperView({ userId: "admin", isAdmin: true, shipperUserId: null }), "not_found")
  })
})

describe("coastalJobVisibleToShipper", () => {
  it("includes assigned jobs and jobs matched to the shipper's runs only", () => {
    assert.equal(
      coastalJobVisibleToShipper({
        shipperId: "shipper",
        requestShipperId: "shipper",
        matchedRunId: null,
        runIds: [],
      }),
      true,
    )
    assert.equal(
      coastalJobVisibleToShipper({
        shipperId: "shipper",
        requestShipperId: "other",
        matchedRunId: "run-1",
        runIds: ["run-1"],
      }),
      true,
    )
    assert.equal(
      coastalJobVisibleToShipper({
        shipperId: "shipper",
        requestShipperId: "other",
        matchedRunId: "run-2",
        runIds: ["run-1"],
      }),
      false,
    )
  })
})

describe("chooseCoastalSale", () => {
  it("uses the latest live order and ignores admin test rows", () => {
    const choice = chooseCoastalSale([
      order({ id: "old", status: "confirmed", createdAt: "2026-10-01T00:00:00.000Z", orderNum: "100" }),
      order({ id: "test", status: "confirmed", createdAt: "2026-10-04T00:00:00.000Z", isAdminTest: true, orderNum: "999" }),
      order({ id: "new", status: "pending", createdAt: "2026-10-03T00:00:00.000Z", orderNum: "1042" }),
    ])
    assert.equal(choice.kind, "placed")
    if (choice.kind === "placed") assert.equal(choice.order.orderNum, "1042")
  })

  it("says the sale was refunded only when no live order remains", () => {
    assert.equal(chooseCoastalSale([order({ status: "refunded" })]).kind, "refunded")
    assert.equal(chooseCoastalSale([]).kind, "none")
  })
})

describe("address snapshots", () => {
  it("copies a listing pin and an order street, and keeps coordinates for the same street", () => {
    const pin = snapshotFromListingPin({ city: "Santa Cruz", state: "CA", latitude: 36.96, longitude: -122.02 })
    assert.equal(pin?.source, "listing")
    assert.equal(pin?.latitude, 36.96)
    assert.equal(snapshotFromListingPin({ city: "Santa Cruz", state: "CA", latitude: 0, longitude: 0 }), null)

    const street = snapshotFromOrderShipping({
      name: "Jordan",
      address: { line1: "123 Main St", city: "Pacifica", state: "CA", postal_code: "94044", country: "US" },
    })
    assert.equal(street?.line1, "123 Main St")
    assert.equal(street?.latitude, null)

    const placed = mergeAddressSnapshot(
      { ...street!, latitude: 37.61, longitude: -122.49, geocodeAttempted: true },
      street,
    )
    assert.equal(placed?.latitude, 37.61)
    assert.equal(addressSnapshotsEqual(placed, { ...street!, latitude: 37.61, longitude: -122.49, geocodeAttempted: true }), true)
  })
})

describe("canSetCoastalStatus", () => {
  it("allows the next handoff and one step back", () => {
    assert.equal(canSetCoastalStatus("waiting_for_run", "picked_up"), true)
    assert.equal(canSetCoastalStatus("picked_up", "dropped_off"), true)
    assert.equal(canSetCoastalStatus("picked_up", "waiting_for_run"), true)
    assert.equal(canSetCoastalStatus("dropped_off", "picked_up"), true)
    assert.equal(canSetCoastalStatus("waiting_for_run", "dropped_off"), false)
    assert.equal(canSetCoastalStatus("waiting_for_run", "cancelled"), true)
    assert.equal(canSetCoastalStatus("cancelled", "waiting_for_run"), true)
    assert.equal(canSetCoastalStatus("picked_up", "cancelled"), false)
    assert.equal(canSetCoastalStatus("dropped_off", "waiting_for_run"), false)
  })
})

describe("buildCoastalRunSheet", () => {
  it("orders this week's runs so the coast is driven once, and uses a house only after a sale", () => {
    const runs: CoastalRunView[] = [
      {
        id: "tue-north",
        dayOfWeek: 2,
        direction: "northbound",
        enabled: true,
        stopIds: ["capitola", "santa-cruz", "san-francisco", "bodega-bay"],
      },
      {
        id: "thu-south",
        dayOfWeek: 4,
        direction: "southbound",
        enabled: false,
        stopIds: ["bodega-bay", "san-francisco"],
      },
    ]
    const sheet = buildCoastalRunSheet({
      now: mondayPacific,
      runs,
      stops,
      jobs: [
        draft({
          id: "waiting-capitola",
          listingTitle: "Almond",
          pickupStopId: "capitola",
          dropoffStopId: "san-francisco",
          status: "waiting_for_run",
          matchedRunId: "tue-north",
        }),
        draft({
          id: "in-car",
          listingTitle: "Fish",
          pickupStopId: "santa-cruz",
          dropoffStopId: "bodega-bay",
          status: "picked_up",
          matchedRunId: "tue-north",
          salePlaced: true,
          dropoffSnapshot: house("88 Wharf Rd, Bodega Bay, CA 94923", 38.33, -123.05),
        }),
        draft({
          id: "done",
          listingTitle: "Log",
          pickupStopId: "capitola",
          dropoffStopId: "santa-cruz",
          status: "dropped_off",
          matchedRunId: "tue-north",
        }),
        draft({
          id: "south-bodega",
          listingTitle: "Gun",
          pickupStopId: "bodega-bay",
          dropoffStopId: "san-francisco",
          status: "waiting_for_run",
          matchedRunId: "thu-south",
        }),
      ],
    })

    assert.equal(sheet.weekLabel, "Week of Oct 4–Oct 10")
    assert.deepEqual(sheet.coverage.map((stop) => stop.name), ["Capitola", "Santa Cruz", "San Francisco", "Bodega Bay"])
    assert.deepEqual(sheet.sections.map((section) => section.key), ["tue-north", "thu-south"])
    assert.equal(sheet.sections[0]?.title, "Tuesday, Oct 6 · Northbound")
    assert.deepEqual(
      sheet.sections[0]?.jobs.map((job) => job.id),
      ["waiting-capitola", "in-car", "done"],
    )
    assert.equal(sheet.sections[0]?.jobs[0]?.pickupKind, "stop")
    assert.equal(sheet.sections[0]?.jobs[0]?.nextHandoff, "Pick up at Capitola")
    assert.equal(sheet.sections[0]?.jobs[1]?.dropoffKind, "house")
    assert.equal(sheet.sections[0]?.jobs[1]?.nextHandoff, "Drop off at 88 Wharf Rd, Bodega Bay, CA 94923")
    assert.equal(sheet.sections[1]?.enabled, false)
    assert.deepEqual(sheet.sections[1]?.jobs.map((job) => job.id), ["south-bodega"])
  })

  it("keeps a board with no sale on the corridor stop", () => {
    const sheet = buildCoastalRunSheet({
      now: mondayPacific,
      runs: [],
      stops,
      jobs: [
        draft({
          id: "unsold",
          listingTitle: "Egg",
          saleLabel: "Sale is not placed",
          pickupSnapshot: house("Listing location", 36.97, -122.01),
          salePlaced: false,
        }),
      ],
    })
    const job = sheet.sections[0]?.jobs[0]
    assert.equal(sheet.sections[0]?.key, "unscheduled")
    assert.equal(job?.saleLabel, "Sale is not placed")
    assert.equal(job?.pickupKind, "stop")
    assert.equal(job?.pickupLabel, "Capitola")
  })
})

function order(overrides: Partial<CoastalSaleOrder> = {}): CoastalSaleOrder {
  return {
    id: "order-1",
    orderNum: "100",
    listingIds: ["listing-1"],
    buyerId: "buyer",
    sellerId: "seller",
    status: "confirmed",
    isAdminTest: false,
    shippingAddress: null,
    createdAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  }
}

function house(label: string, latitude: number, longitude: number): CoastalAddressSnapshot {
  return {
    label,
    line1: label,
    line2: null,
    city: null,
    state: null,
    postalCode: null,
    latitude,
    longitude,
    source: "order",
    geocodeAttempted: true,
  }
}

function draft(overrides: Partial<CoastalJobDraft> & Pick<CoastalJobDraft, "id" | "listingTitle">): CoastalJobDraft {
  return {
    listingId: "listing-1",
    saleLabel: "Order 1042",
    buyerName: "Jordan",
    sellerName: "Avery",
    sellerOriginLabel: "",
    status: "waiting_for_run",
    matchedRunId: null,
    pickupStopId: "capitola",
    dropoffStopId: "san-francisco",
    pickupSnapshot: null,
    dropoffSnapshot: null,
    salePlaced: true,
    statusActionsEnabled: true,
    ...overrides,
  }
}
