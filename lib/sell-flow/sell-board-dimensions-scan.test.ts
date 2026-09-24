import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { boardDimensionsFromScan } from "./sell-board-dimensions-scan.ts"

describe("boardDimensionsFromScan", () => {
  it("fills the sell form from an imperial stamp", () => {
    assert.deepEqual(
      boardDimensionsFromScan({
        lengthText: `5'10"`,
        widthText: `19 1/4"`,
        thicknessText: "2 1/2",
        volumeText: "32.5 L",
        unit: "in",
        rawText: `5'10" x 19 1/4" x 2 1/2" 32.5L`,
      }),
      {
        boardLength: "5'10",
        boardWidthInches: "19 1/4",
        boardThicknessInches: "2 1/2",
        boardVolumeL: "32.5",
        rawText: `5'10" x 19 1/4" x 2 1/2" 32.5L`,
        formatLabel: "Length × width × thickness, in inches",
      },
    )
  })

  it("converts a centimeter stamp onto the inch grid", () => {
    const fields = boardDimensionsFromScan({
      lengthText: "178",
      widthText: "49.5",
      thicknessText: "6.0",
      volumeText: "28.4",
      unit: "cm",
      rawText: "178.0 x 49.5 x 6.0 cm / 28.4 L",
    })
    assert.ok(fields)
    assert.equal(fields.boardLength, "5'10")
    assert.equal(fields.boardWidthInches, "19 1/2")
    assert.equal(fields.boardThicknessInches, "2 3/8")
    assert.equal(fields.boardVolumeL, "28.4")
    assert.equal(fields.formatLabel, "Centimeters, converted to feet and inches")
  })

  it("reads a stamp the model only returned as one line", () => {
    const fields = boardDimensionsFromScan({
      lengthText: "",
      widthText: "",
      thicknessText: "",
      volumeText: "",
      unit: "",
      rawText: `6'2" x 19.25" x 2.5" 31.2L`,
    })
    assert.ok(fields)
    assert.equal(fields.boardLength, "6'2")
    assert.equal(fields.boardWidthInches, "19 1/4")
    assert.equal(fields.boardThicknessInches, "2 1/2")
    assert.equal(fields.boardVolumeL, "31.2")
  })

  it("prefers the inch side when a field prints both units", () => {
    const fields = boardDimensionsFromScan({
      lengthText: `5'11" / 180cm`,
      widthText: `19 1/2" / 49.5cm`,
      thicknessText: `2 7/16" / 6.2cm`,
      volumeText: "30",
      unit: "cm",
      rawText: `5'11" / 180cm x 19 1/2" / 49.5cm x 2 7/16" / 6.2cm`,
    })
    assert.ok(fields)
    assert.equal(fields.boardLength, "5'11")
    assert.equal(fields.boardWidthInches, "19 1/2")
    assert.equal(fields.boardThicknessInches, "2 7/16")
    assert.equal(fields.formatLabel, "Length × width × thickness, in inches")
  })

  it("treats a bare 178 as centimeters when the unit was missed", () => {
    const fields = boardDimensionsFromScan({
      lengthText: "178",
      widthText: "49",
      thicknessText: "6",
      volumeText: "",
      unit: "",
      rawText: "",
    })
    assert.ok(fields)
    assert.equal(fields.formatLabel, "Centimeters, converted to feet and inches")
    assert.equal(fields.boardLength, "5'10")
  })

  it("reads a stacked stamp with no multiplication signs", () => {
    const fields = boardDimensionsFromScan({
      lengthText: "",
      widthText: "",
      thicknessText: "",
      volumeText: "",
      unit: "in",
      rawText: "5'8\n20 1/4\n2 5/8\n33.1 L",
    })
    assert.ok(fields)
    assert.equal(fields.boardLength, "5'8")
    assert.equal(fields.boardWidthInches, "20 1/4")
    assert.equal(fields.boardThicknessInches, "2 5/8")
    assert.equal(fields.boardVolumeL, "33.1")
  })

  it("returns null when the stamp is unreadable", () => {
    assert.equal(
      boardDimensionsFromScan({
        lengthText: "unknown",
        widthText: "",
        thicknessText: "null",
        volumeText: "",
        unit: "",
        rawText: "",
      }),
      null,
    )
  })
})
