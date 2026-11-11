import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingBoardSpecRows, listingPublicSpecRows } from "./listing-board-spec-rows.ts"

const BOARD_DIMENSIONS = `{"v":2,"L":"5'5","W":"18 1/2","T":"2 3/16","V":"25.6"}`

describe("listingBoardSpecRows", () => {
  it("prints fins included, construction, and fin facts for a surfboard", () => {
    const rows = listingBoardSpecRows({
      section: "surfboards",
      condition: "excellent",
      dimensions: BOARD_DIMENSIONS,
      construction: "eps_epoxy",
      fin_system: "futures",
      fins_setup: "thruster",
      fins_included: false,
    })
    assert.deepEqual(
      rows.map((row) => [row.label, row.value]),
      [
        ["Condition", "Used – Excellent"],
        ["Dimensions", "5'5″ × 18 1/2″ × 2 3/16″"],
        ["Volume", "25.6 L"],
        ["Construction", "EPS/Epoxy"],
        ["Fin system", "Futures"],
        ["Fin setup", "Thruster"],
        ["Fins included", "Not included"],
      ],
    )
  })

  it("prints Included when the seller packed fins with the board", () => {
    const rows = listingBoardSpecRows({
      condition: "good",
      fins_included: true,
    })
    assert.equal(
      rows.find((row) => row.label === "Fins included")?.value,
      "Included",
    )
  })

  it("omits fins included when the seller did not specify", () => {
    const rows = listingBoardSpecRows({
      condition: "good",
      fins_included: null,
    })
    assert.equal(
      rows.some((row) => row.label === "Fins included"),
      false,
    )
  })
})

describe("listingPublicSpecRows", () => {
  it("keeps Shape on surfboards and matches the website spec table", () => {
    const rows = listingPublicSpecRows({
      section: "surfboards",
      board_type: "groveler",
      condition: "excellent",
      dimensions: BOARD_DIMENSIONS,
      construction: "pu_poly",
      fin_system: "fcs_ii",
      fins_setup: "twin",
      fins_included: true,
    })
    assert.deepEqual(
      rows.map((row) => [row.label, row.value]),
      [
        ["Condition", "Used – Excellent"],
        ["Shape", "Groveler"],
        ["Dimensions", "5'5″ × 18 1/2″ × 2 3/16″"],
        ["Volume", "25.6 L"],
        ["Construction", "PU/Poly"],
        ["Fin system", "FCS II"],
        ["Fin setup", "Twin (2+1)"],
        ["Fins included", "Included"],
      ],
    )
  })

  it("prints fin size, setup, and system for a fins listing", () => {
    const rows = listingPublicSpecRows({
      section: "fins",
      condition: "very_good",
      fin_size: "m",
      fins_setup: "thruster",
      fin_system: "futures",
    })
    assert.deepEqual(
      rows.map((row) => [row.label, row.value]),
      [
        ["Condition", "Used – Very Good"],
        ["Size", "Medium"],
        ["Fin setup", "Thruster"],
        ["Fin system", "Futures"],
      ],
    )
  })
})
