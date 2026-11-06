import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  capitalizeWords,
  normalizeExcessiveCapitalization,
} from "./listing-labels.ts"

describe("normalizeExcessiveCapitalization", () => {
  it("converts shouting all-caps words to title case", () => {
    assert.equal(
      normalizeExcessiveCapitalization("CHANNEL ISLANDS SHORTBOARD"),
      "Channel Islands Shortboard",
    )
    assert.equal(
      normalizeExcessiveCapitalization("FIREWIRE HELIUM DOMINATOR"),
      "Firewire Helium Dominator",
    )
  })

  it("preserves short acronyms and initials Google allows", () => {
    assert.equal(normalizeExcessiveCapitalization("FCS II thruster"), "FCS II thruster")
    assert.equal(normalizeExcessiveCapitalization("Size XL in the UK"), "Size XL in the UK")
    assert.equal(normalizeExcessiveCapitalization("ADHD guide USD"), "ADHD guide USD")
    assert.equal(normalizeExcessiveCapitalization("UNICEF fundraiser"), "UNICEF fundraiser")
  })

  it("preserves known acronyms inside a shouting title", () => {
    assert.equal(
      normalizeExcessiveCapitalization("FCS II THRUSTER SET"),
      "FCS II Thruster Set",
    )
  })

  it("title-cases short filler words when the whole string is shouting", () => {
    assert.equal(
      normalizeExcessiveCapitalization("GREAT BOARD WITH MINOR RAIL DINGS"),
      "Great Board With Minor Rail Dings",
    )
  })

  it("preserves alphanumeric model codes", () => {
    assert.equal(normalizeExcessiveCapitalization("CI XF2 FISH"), "CI XF2 Fish")
    assert.equal(normalizeExcessiveCapitalization("G10 twin"), "G10 twin")
    assert.equal(normalizeExcessiveCapitalization("FCS 5FIN SET"), "FCS 5FIN Set")
  })

  it("title-cases contractions and possessives without mangling the suffix", () => {
    assert.equal(
      normalizeExcessiveCapitalization("GREAT BOARD THAT CAN'T MISS"),
      "Great Board That Can't Miss",
    )
    assert.equal(
      normalizeExcessiveCapitalization("THE BOARD'S RAIL HAS DINGS"),
      "The Board's Rail Has Dings",
    )
    assert.equal(
      normalizeExcessiveCapitalization("I'VE USED THIS BOARD TWICE"),
      "I've Used This Board Twice",
    )
    assert.equal(
      normalizeExcessiveCapitalization("O'NEILL PSYCHO TECH"),
      "O'Neill Psycho Tech",
    )
  })

  it("leaves mixed-case and already-normal text alone", () => {
    assert.equal(
      normalizeExcessiveCapitalization("Channel Islands Twin Pin"),
      "Channel Islands Twin Pin",
    )
    assert.equal(
      normalizeExcessiveCapitalization("Slight ding on rail, otherwise clean."),
      "Slight ding on rail, otherwise clean.",
    )
  })

  it("title-cases hyphenated all-caps tokens", () => {
    assert.equal(normalizeExcessiveCapitalization("STEP-UP GUN"), "Step-Up Gun")
  })
})

describe("capitalizeWords", () => {
  it("title-cases and strips excessive caps for listing titles", () => {
    assert.equal(capitalizeWords("channel islands twin pin"), "Channel Islands Twin Pin")
    assert.equal(capitalizeWords("CHANNEL ISLANDS TWIN PIN"), "Channel Islands Twin Pin")
    assert.equal(capitalizeWords("  FCS II THRUSTER SET  "), "FCS II Thruster Set")
    assert.equal(capitalizeWords("BOARD'S RAIL HAS DINGS"), "Board's Rail Has Dings")
    assert.equal(capitalizeWords("FCS 5FIN SET"), "FCS 5FIN Set")
  })
})
