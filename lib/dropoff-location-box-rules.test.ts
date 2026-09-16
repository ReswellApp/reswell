import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  applyDropoffPackedParcelToListingRow,
  dropoffRuleToPackedListingFields,
  matchDropoffBoxRule,
  parseDropoffBoxRules,
  sellFormFieldsFromDropoffLocation,
  type DropoffBoxRule,
} from "./dropoff-location-box-rules.ts"

const SANTA_BARBARA_RULES: DropoffBoxRule[] = parseDropoffBoxRules([
  {
    id: "under-6-0",
    label: "6'0 and under, 22\" wide or less",
    minLengthIn: null,
    maxLengthIn: 72,
    maxWidthIn: 22,
    boxLengthIn: 76,
    boxWidthIn: 22,
    boxHeightIn: 5,
    weightLb: 14,
  },
  {
    id: "6-1-to-6-6",
    label: "6'1–6'6",
    minLengthIn: 72.01,
    maxLengthIn: 78,
    maxWidthIn: null,
    boxLengthIn: 84,
    boxWidthIn: 22,
    boxHeightIn: 5,
    weightLb: 18,
  },
])

describe("matchDropoffBoxRule Santa Barbara", () => {
  it("maps 6'0 × 22 to the 76×22×5 carton", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'0",
      boardWidthInches: "22",
    })
    assert.ok(match)
    assert.equal(match.rule.id, "under-6-0")
    assert.equal(match.rule.boxLengthIn, 76)
  })

  it("maps a shorter narrower board to the compact carton", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "5'10",
      boardWidthInches: "19 1/2",
    })
    assert.ok(match)
    assert.equal(match.rule.boxLengthIn, 76)
  })

  it("does not match 6'0 when width is over 22", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'0",
      boardWidthInches: "23",
    })
    assert.equal(match, null)
  })

  it("maps 6'1–6'6 to the 84×22×5 carton", () => {
    const sixOne = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'1",
      boardWidthInches: "21",
    })
    const sixSix = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'6",
      boardWidthInches: "22",
    })
    assert.ok(sixOne)
    assert.ok(sixSix)
    assert.equal(sixOne.rule.boxLengthIn, 84)
    assert.equal(sixSix.rule.boxLengthIn, 84)
  })

  it("rejects boards longer than 6'6", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'8",
      boardWidthInches: "21",
    })
    assert.equal(match, null)
  })

  it("requires width for the compact rule", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "5'11",
      boardWidthInches: "",
    })
    assert.equal(match, null)
  })

  it("writes the matched carton onto listing packed columns", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'0",
      boardWidthInches: "22",
    })
    assert.ok(match)
    const packed = dropoffRuleToPackedListingFields(match.rule)
    assert.equal(packed.shipping_packed_length_in, 76)
    assert.equal(packed.shipping_packed_width_in, 22)
    assert.equal(packed.shipping_packed_height_in, 5)
    assert.equal(packed.shipping_packed_weight_oz, 224)
    assert.equal(packed.shipping_package_band, null)
  })

  it("fills sell-form package fields from the matched Santa Barbara box", () => {
    const fields = sellFormFieldsFromDropoffLocation(
      { id: "sb", boxRules: SANTA_BARBARA_RULES },
      { boardLength: "6'0", boardWidthInches: "21.5" },
    )
    assert.ok(fields)
    assert.equal(fields.dropoffLocationId, "sb")
    assert.equal(fields.reswellPackageLengthIn, "76")
    assert.equal(fields.reswellPackageWidthIn, "22")
    assert.equal(fields.reswellPackageHeightIn, "5")
    assert.equal(fields.reswellPackageWeightLb, "14")
    assert.equal(fields.reswellPackageWeightOz, "0")
  })

  it("overwrites listing packed dims when a dropoff city matches", () => {
    const row = applyDropoffPackedParcelToListingRow(
      {
        shipping_available: true,
        shipping_packed_length_in: 90,
        shipping_packed_width_in: 10,
        shipping_packed_height_in: 10,
        shipping_packed_weight_oz: 80,
      },
      {
        dropoffLocationId: "sb",
        boardLength: "6'2",
        boardWidthInches: "21",
        boxRules: SANTA_BARBARA_RULES,
      },
    )
    assert.equal(row.dropoff_location_id, "sb")
    assert.equal(row.shipping_packed_length_in, 84)
    assert.equal(row.shipping_packed_width_in, 22)
    assert.equal(row.shipping_packed_height_in, 5)
    assert.equal(row.shipping_packed_weight_oz, 288)
  })
})
