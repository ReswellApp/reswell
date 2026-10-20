import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  HOW_TO_SELL_BEST_RATE_BOX,
  HOW_TO_SELL_BEST_RATE_FLAT_BOX,
  HOW_TO_SELL_BEST_RATE_MAX_BOARD_LENGTH,
  HOW_TO_SELL_BOX_CALCULATOR_PRESETS,
  HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH,
  HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD,
  howToSellBestBoxSizesFormNote,
  howToSellBestBoxSizesLead,
} from "@/lib/seller-resources-box-guide"
import { surfboardShippingDimIn } from "@/lib/shipping/surfboard-label-limits"
import {
  UPS_LARGE_PACKAGE_DIM_IN,
  upsParcelSurchargeFlags,
} from "@/lib/shipping/ups-parcel-surcharge-flags"

describe("how to sell best box sizes", () => {
  it("keeps 76×22×5 and 76×23×4 on the large-package line for boards 5′10 and under", () => {
    assert.deepEqual(HOW_TO_SELL_BEST_RATE_BOX, { lengthIn: 76, widthIn: 22, heightIn: 5 })
    assert.deepEqual(HOW_TO_SELL_BEST_RATE_FLAT_BOX, { lengthIn: 76, widthIn: 23, heightIn: 4 })
    assert.equal(HOW_TO_SELL_BEST_RATE_MAX_BOARD_LENGTH, "5′10")
    assert.equal(HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH, "5′11")
    assert.equal(HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD.jump, 100)

    for (const box of [HOW_TO_SELL_BEST_RATE_BOX, HOW_TO_SELL_BEST_RATE_FLAT_BOX]) {
      const dim = surfboardShippingDimIn(box.lengthIn, box.widthIn, box.heightIn)
      assert.equal(dim, UPS_LARGE_PACKAGE_DIM_IN)
      const flags = upsParcelSurchargeFlags({ ...box, weightLb: 14 })
      assert.equal(flags.dimOver130, false)
      assert.equal(flags.largePackageLikely, false)
    }
  })

  it("treats a taller 23″ carton as a large package", () => {
    const dim = surfboardShippingDimIn(76, 23, 5)
    assert.ok(dim > UPS_LARGE_PACKAGE_DIM_IN)
  })

  it("names both cartons and the $100 fee in seller copy", () => {
    const lead = howToSellBestBoxSizesLead()
    const note = howToSellBestBoxSizesFormNote()
    for (const copy of [lead, note]) {
      assert.match(copy, /76×22×5/)
      assert.match(copy, /76×23×4/)
      assert.match(copy, /5′10/)
      assert.match(copy, /5′11/)
      assert.match(copy, /\$100/)
    }
    assert.match(lead, /UPS and other carriers/)
  })

  it("offers both best cartons in the sample-rate presets", () => {
    const flat = HOW_TO_SELL_BOX_CALCULATOR_PRESETS.find((preset) => preset.id === "best-rate-flat")
    const square = HOW_TO_SELL_BOX_CALCULATOR_PRESETS.find((preset) => preset.id === "best-rate")
    assert.equal(square?.widthIn, 22)
    assert.equal(square?.heightIn, 5)
    assert.equal(flat?.lengthIn, 76)
    assert.equal(flat?.widthIn, 23)
    assert.equal(flat?.heightIn, 4)
  })
})
