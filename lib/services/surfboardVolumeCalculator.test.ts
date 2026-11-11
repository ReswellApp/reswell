import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CUBIC_INCHES_TO_LITERS,
  estimateSurfboardVolumeLiters,
  parseSurfboardVolumeFormInput,
  resolveShapeFactor,
} from "@/lib/services/surfboardVolumeCalculator"

describe("estimateSurfboardVolumeLiters", () => {
  it("matches the Guild worked example for a 6'6 x 20 x 2.5 shortboard mid-factor", () => {
    // 78 × 20 × 2.5 × 0.55 × 0.016387064 ≈ 35.15 L (Calculatorzilo / Guild example)
    const result = estimateSurfboardVolumeLiters({
      lengthInches: 78,
      widthInches: 20,
      thicknessInches: 2.5,
      outline: "other", // base 0.55
      fullness: "standard",
    })
    assert.equal(result.shapeFactor, 0.55)
    assert.ok(Math.abs(result.liters - 35.15) < 0.05)
    assert.equal(result.litersDisplay, 35.2)
  })

  it("increases volume for fuller outlines at the same dimensions", () => {
    const shortboard = estimateSurfboardVolumeLiters({
      lengthInches: 72,
      widthInches: 19.5,
      thicknessInches: 2.5,
      outline: "shortboard",
      fullness: "standard",
    })
    const fish = estimateSurfboardVolumeLiters({
      lengthInches: 72,
      widthInches: 19.5,
      thicknessInches: 2.5,
      outline: "fish",
      fullness: "standard",
    })
    const longboard = estimateSurfboardVolumeLiters({
      lengthInches: 72,
      widthInches: 19.5,
      thicknessInches: 2.5,
      outline: "longboard",
      fullness: "standard",
    })
    assert.ok(fish.liters > shortboard.liters)
    assert.ok(longboard.liters > fish.liters)
  })

  it("nudges shape factor with outline fullness", () => {
    assert.equal(resolveShapeFactor("shortboard", "pulled-in"), 0.51)
    assert.equal(resolveShapeFactor("shortboard", "standard"), 0.54)
    assert.equal(resolveShapeFactor("shortboard", "full"), 0.57)
  })

  it("exposes a ±5% liter range for manufacturer comparison", () => {
    const result = estimateSurfboardVolumeLiters({
      lengthInches: 70,
      widthInches: 20.5,
      thicknessInches: 2.625,
      outline: "fish",
      fullness: "standard",
    })
    assert.ok(result.rangeLiters.low < result.litersDisplay)
    assert.ok(result.rangeLiters.high > result.litersDisplay)
  })

  it("uses the exact cubic-inch to liter constant", () => {
    assert.equal(CUBIC_INCHES_TO_LITERS, 0.016387064)
  })
})

describe("parseSurfboardVolumeFormInput", () => {
  it("parses feet-inch length and fraction width/thickness", () => {
    const parsed = parseSurfboardVolumeFormInput({
      boardLength: "6'2",
      boardWidthInches: "19 1/4",
      boardThicknessInches: "2 3/8",
      outline: "shortboard",
      fullness: "standard",
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.input.lengthInches, 74)
    assert.equal(parsed.input.widthInches, 19.25)
    assert.equal(parsed.input.thicknessInches, 2.375)
    assert.equal(parsed.input.outline, "shortboard")
  })

  it("rejects missing outline", () => {
    const parsed = parseSurfboardVolumeFormInput({
      boardLength: "6'0",
      boardWidthInches: "19",
      boardThicknessInches: "2.5",
      outline: "",
    })
    assert.equal(parsed.ok, false)
  })

  it("rejects incomplete length", () => {
    const parsed = parseSurfboardVolumeFormInput({
      boardLength: "6",
      boardWidthInches: "19",
      boardThicknessInches: "2.5",
      outline: "hybrid",
    })
    assert.equal(parsed.ok, false)
  })
})
