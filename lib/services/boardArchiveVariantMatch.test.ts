import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  parseBoardArchiveLengthInches,
  parseBoardArchiveVolumeLiters,
  selectBoardArchiveVariant,
  type BoardArchiveVariantCandidate,
} from "./boardArchiveVariantMatch.ts"

const ghost: BoardArchiveVariantCandidate = {
  id: "ghost-510",
  lengthInches: parseBoardArchiveLengthInches("5'10"),
  volumeLiters: parseBoardArchiveVolumeLiters("28.5L"),
  finBoxType: "futures",
  finBoxes: "thruster",
}
const ghostFcs: BoardArchiveVariantCandidate = {
  id: "ghost-510-fcs",
  lengthInches: 70,
  volumeLiters: 28.5,
  finBoxType: "fcs_ii",
  finBoxes: "thruster",
}
const ghostLonger: BoardArchiveVariantCandidate = {
  id: "ghost-60",
  lengthInches: parseBoardArchiveLengthInches("6'0"),
  volumeLiters: parseBoardArchiveVolumeLiters("32L"),
  finBoxType: "futures",
  finBoxes: "thruster",
}

describe("parseBoardArchiveLengthInches", () => {
  it("reads feet, whole inches, and a trailing fraction", () => {
    assert.equal(parseBoardArchiveLengthInches("5'10"), 70)
    assert.equal(parseBoardArchiveLengthInches("5'10 1/2"), 70.5)
    assert.equal(parseBoardArchiveLengthInches("6'"), 72)
    assert.equal(parseBoardArchiveLengthInches("5′10.5"), 70.5)
  })

  it("rejects labels that are not a board length", () => {
    assert.equal(parseBoardArchiveLengthInches("28.5L"), null)
    assert.equal(parseBoardArchiveLengthInches("5'13"), null)
    assert.equal(parseBoardArchiveLengthInches(""), null)
  })
})

describe("parseBoardArchiveVolumeLiters", () => {
  it("reads the first number", () => {
    assert.equal(parseBoardArchiveVolumeLiters("28.5L"), 28.5)
    assert.equal(parseBoardArchiveVolumeLiters("28 L"), 28)
  })
})

describe("selectBoardArchiveVariant", () => {
  const candidates = [ghost, ghostFcs, ghostLonger]

  it("picks the single size that matches length and volume", () => {
    assert.equal(
      selectBoardArchiveVariant(candidates, {
        lengthTotalInches: 72,
        volumeLiters: 32,
        finSystem: null,
        finsSetup: null,
      }),
      "ghost-60",
    )
  })

  it("uses fin system only to break a size tie", () => {
    assert.equal(
      selectBoardArchiveVariant(candidates, {
        lengthTotalInches: 70,
        volumeLiters: 28.5,
        finSystem: "fcs_ii",
        finsSetup: null,
      }),
      "ghost-510-fcs",
    )
  })

  it("leaves the variant empty when two sizes still match", () => {
    assert.equal(
      selectBoardArchiveVariant(candidates, {
        lengthTotalInches: 70,
        volumeLiters: 28.5,
        finSystem: null,
        finsSetup: null,
      }),
      null,
    )
  })

  it("leaves the variant empty when the listing has no measurements", () => {
    assert.equal(
      selectBoardArchiveVariant(candidates, {
        lengthTotalInches: null,
        volumeLiters: null,
        finSystem: "futures",
        finsSetup: "thruster",
      }),
      null,
    )
  })

  it("accepts the listing length bucket when the catalog size is a half inch away", () => {
    assert.equal(
      selectBoardArchiveVariant(
        [
          {
            id: "half",
            lengthInches: 70.5,
            volumeLiters: 29,
            finBoxType: "futures",
            finBoxes: "thruster",
          },
        ],
        {
          lengthTotalInches: 70,
          volumeLiters: 29,
          finSystem: null,
          finsSetup: null,
        },
      ),
      "half",
    )
  })
})
