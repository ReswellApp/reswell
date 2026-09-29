import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { describe, it } from "node:test"

const require = createRequire(import.meta.url)
const santaBarbaraDropoff = require(
  "./dropoff-santa-barbara.ts",
) as typeof import("./dropoff-santa-barbara")

const {
  listingUsesSantaBarbaraDropoff,
  listingsUseSantaBarbaraDropoff,
  orderUsesSantaBarbaraDropoff,
  SANTA_BARBARA_DROPOFF_LOCATION_ID,
} = santaBarbaraDropoff

describe("listingUsesSantaBarbaraDropoff", () => {
  it("matches the saved Santa Barbara location id", () => {
    assert.equal(
      listingUsesSantaBarbaraDropoff({
        dropoff_location_id: SANTA_BARBARA_DROPOFF_LOCATION_ID,
      }),
      true,
    )
  })

  it("matches the embedded location slug for rows loaded through Supabase", () => {
    assert.equal(
      listingUsesSantaBarbaraDropoff({
        dropoff_location_id: "another-environment-id",
        dropoff_locations: [{ slug: "santa-barbara" }],
      }),
      true,
    )
  })

  it("does not match a listing that did not choose Santa Barbara drop-off", () => {
    assert.equal(
      listingUsesSantaBarbaraDropoff({
        dropoff_location_id: null,
        dropoff_locations: null,
      }),
      false,
    )
    assert.equal(
      listingUsesSantaBarbaraDropoff({
        dropoff_location_id: "other-location",
        dropoff_locations: { slug: "ventura" },
      }),
      false,
    )
  })
})

describe("listingsUseSantaBarbaraDropoff", () => {
  it("protects a multi-item order when any listing chose the location", () => {
    assert.equal(
      listingsUseSantaBarbaraDropoff([
        { dropoff_location_id: null },
        { dropoff_locations: { slug: "santa-barbara" } },
      ]),
      true,
    )
  })
})

describe("orderUsesSantaBarbaraDropoff", () => {
  it("matches a packed line even when the primary listing embed is an array", () => {
    assert.equal(
      orderUsesSantaBarbaraDropoff({
        listings: [{ dropoff_location_id: null }],
        order_items: [
          { listings: { dropoff_locations: { slug: "santa-barbara" } } },
        ],
      }),
      true,
    )
  })

  it("does not match an order that ships from the seller", () => {
    assert.equal(
      orderUsesSantaBarbaraDropoff({
        listings: { dropoff_location_id: null, dropoff_locations: { slug: "ventura" } },
      }),
      false,
    )
  })
})
