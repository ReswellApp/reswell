import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BOARD_LENGTH_FOCUS_VALUE,
  BOARD_LENGTH_OPTIONS,
  BOARD_THICKNESS_FOCUS_VALUE,
  BOARD_WIDTH_FOCUS_VALUE,
} from "@/lib/board-dimension-options"
import { FIN_SETUP_OPTIONS } from "@/lib/boards-browse-facets"
import { getMobileSellBoardSpecs } from "@/lib/services/mobileSellBoardSpecs"

describe("mobile sell board specs", () => {
  it("matches the website photos-step dimensions and fins", () => {
    const specs = getMobileSellBoardSpecs()
    const dimensions = specs.sections.find((section) => section.id === "dimensions")
    const facets = specs.sections.find((section) => section.id === "facets")
    assert.ok(dimensions)
    assert.ok(facets)
    assert.equal(facets?.title, "Fins & construction")

    const length = dimensions?.fields.find((field) => field.id === "length")
    assert.equal(length?.required, true)
    assert.equal(length?.kind, "select")
    assert.equal(length?.options.length, BOARD_LENGTH_OPTIONS.length)
    assert.equal(length?.options[0]?.value, BOARD_LENGTH_OPTIONS[0]?.value)

    const volume = dimensions?.fields.find((field) => field.id === "volume")
    assert.equal(volume?.kind, "text")
    assert.equal(volume?.suffix, "L")
    assert.equal(volume?.required, false)

    const width = dimensions?.fields.find((field) => field.id === "width")
    assert.ok(width?.options.some((option) => option.decimal_label))
    assert.equal(length?.focus_value, BOARD_LENGTH_FOCUS_VALUE)
    assert.equal(width?.focus_value, BOARD_WIDTH_FOCUS_VALUE)
    assert.equal(
      dimensions?.fields.find((field) => field.id === "thickness")?.focus_value,
      BOARD_THICKNESS_FOCUS_VALUE,
    )

    const finSetup = facets?.fields.find((field) => field.id === "fin_setup")
    assert.equal(finSetup?.options[0]?.label, "Not specified")
    assert.deepEqual(
      finSetup?.options.slice(1).map((option) => option.value),
      FIN_SETUP_OPTIONS.map((option) => option.value),
    )
  })
})