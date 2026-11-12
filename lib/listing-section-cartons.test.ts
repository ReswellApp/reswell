import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PEER_LISTING_SECTIONS } from "./peer-listing-sections.ts"
import {
  LISTING_SECTION_DEFAULT_CARTONS,
  defaultListingSectionCarton,
  defaultListingSectionCartonColumns,
  listingSectionUsesSurfboardCarton,
} from "./listing-section-cartons.ts"

describe("listing section cartons", () => {
  it("gives every non-surfboard category its own default carton", () => {
    for (const section of PEER_LISTING_SECTIONS) {
      if (section === "surfboards") {
        assert.equal(listingSectionUsesSurfboardCarton(section), true)
        assert.equal(defaultListingSectionCarton(section), null)
        continue
      }
      assert.equal(listingSectionUsesSurfboardCarton(section), false)
      const carton = defaultListingSectionCarton(section)
      assert.ok(carton, `${section} needs a default carton`)
      assert.equal(carton, LISTING_SECTION_DEFAULT_CARTONS[section])
      assert.ok(carton.lengthIn <= 48, `${section} carton must stay a small parcel`)
    }
  })

  it("does not let a missing section inherit the surfboard carton family", () => {
    assert.equal(listingSectionUsesSurfboardCarton(undefined), false)
    assert.equal(listingSectionUsesSurfboardCarton(""), false)
    assert.equal(defaultListingSectionCartonColumns("surfboards"), null)
    assert.equal(defaultListingSectionCartonColumns("fins")?.shipping_packed_length_in, 10)
    assert.equal(defaultListingSectionCartonColumns("leashes")?.shipping_packed_length_in, 12)
    assert.equal(defaultListingSectionCartonColumns("boardbags")?.shipping_packed_length_in, 36)
  })
})
