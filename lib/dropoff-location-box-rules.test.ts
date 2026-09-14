import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  matchDropoffBoxRule,
  parseDropoffBoxRules,
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
})
