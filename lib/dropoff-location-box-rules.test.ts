import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { SANTA_BARBARA_DROPOFF_BOX_RULES } from "./dropoff-santa-barbara.ts"
import {
  applyDropoffPackedParcelToListingRow,
  dropoffRuleToPackedListingFields,
  matchDropoffBoxRule,
  parseDropoffBoxRules,
  sellFormFieldsFromDropoffLocation,
} from "./dropoff-location-box-rules.ts"

const SANTA_BARBARA_RULES = parseDropoffBoxRules(SANTA_BARBARA_DROPOFF_BOX_RULES)

describe("matchDropoffBoxRule Santa Barbara", () => {
  it("maps 5'10 and under to the 74×23×5 carton at 16 lb", () => {
    const fiveTen = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "5'10",
      boardWidthInches: "23",
    })
    const shorter = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "5'8",
      boardWidthInches: "",
    })
    assert.ok(fiveTen)
    assert.ok(shorter)
    assert.equal(fiveTen.rule.id, "under-5-10")
    assert.equal(fiveTen.rule.boxLengthIn, 74)
    assert.equal(fiveTen.rule.boxWidthIn, 23)
    assert.equal(fiveTen.rule.boxHeightIn, 5)
    assert.equal(fiveTen.rule.weightLb, 16)
    assert.equal(shorter.rule.id, "under-5-10")
  })

  it("maps 5'11 and up to the 86×23×5 carton at 18 lb", () => {
    const fiveEleven = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "5'11",
      boardWidthInches: "19 1/2",
    })
    const sixTwo = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "6'2",
      boardWidthInches: "22",
    })
    const nineOh = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "9'0",
      boardWidthInches: "23",
    })
    assert.ok(fiveEleven)
    assert.ok(sixTwo)
    assert.ok(nineOh)
    assert.equal(fiveEleven.rule.id, "5-11-and-up")
    assert.equal(fiveEleven.rule.boxLengthIn, 86)
    assert.equal(fiveEleven.rule.boxWidthIn, 23)
    assert.equal(fiveEleven.rule.boxHeightIn, 5)
    assert.equal(fiveEleven.rule.weightLb, 18)
    assert.equal(sixTwo.rule.boxLengthIn, 86)
    assert.equal(nineOh.rule.boxLengthIn, 86)
  })

  it("writes the matched carton onto listing packed columns", () => {
    const match = matchDropoffBoxRule(SANTA_BARBARA_RULES, {
      boardLength: "5'10",
      boardWidthInches: "22",
    })
    assert.ok(match)
    const packed = dropoffRuleToPackedListingFields(match.rule)
    assert.equal(packed.shipping_packed_length_in, 74)
    assert.equal(packed.shipping_packed_width_in, 23)
    assert.equal(packed.shipping_packed_height_in, 5)
    assert.equal(packed.shipping_packed_weight_oz, 256)
    assert.equal(packed.shipping_package_band, null)
  })

  it("fills sell-form package fields from the matched Santa Barbara box", () => {
    const fields = sellFormFieldsFromDropoffLocation(
      { id: "sb", boxRules: SANTA_BARBARA_RULES },
      { boardLength: "5'10", boardWidthInches: "21.5" },
    )
    assert.ok(fields)
    assert.equal(fields.dropoffLocationId, "sb")
    assert.equal(fields.reswellPackageLengthIn, "74")
    assert.equal(fields.reswellPackageWidthIn, "23")
    assert.equal(fields.reswellPackageHeightIn, "5")
    assert.equal(fields.reswellPackageWeightLb, "16")
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
    assert.equal(row.shipping_packed_length_in, 86)
    assert.equal(row.shipping_packed_width_in, 23)
    assert.equal(row.shipping_packed_height_in, 5)
    assert.equal(row.shipping_packed_weight_oz, 288)
  })
})
