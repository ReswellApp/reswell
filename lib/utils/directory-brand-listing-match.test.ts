import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingMatchesBrandOnlyQuery,
  listingMatchesDirectoryBrandInventory,
} from "./directory-brand-listing-match.ts"

const LOST_ID = "11111111-1111-4111-8111-111111111111"

describe("directory brand inventory for saved-search alerts", () => {
  it("matches a listing tied to Lost Surfboards", () => {
    assert.equal(
      listingMatchesDirectoryBrandInventory(
        {
          brand_id: LOST_ID,
          brand: "Lost",
          title: "RNF 5'11",
          model: "RNF",
        },
        { id: LOST_ID, name: "Lost Surfboards" },
      ),
      true,
    )
  })

  it("matches a Mayhem listing through the Lost alias", () => {
    assert.equal(
      listingMatchesDirectoryBrandInventory(
        {
          brand_id: null,
          brand: "Mayhem",
          title: "Sub Driver",
          model: "Sub Driver",
        },
        { id: LOST_ID, name: "Lost Surfboards" },
      ),
      true,
    )
  })

  it("does not match an Allan Gibbons board for a Lost Surfboards search", () => {
    assert.equal(
      listingMatchesDirectoryBrandInventory(
        {
          brand_id: "22222222-2222-4222-8222-222222222222",
          brand: "Allan Gibbons",
          title: "allan gibbons",
          model: null,
        },
        { id: LOST_ID, name: "Lost Surfboards" },
      ),
      false,
    )
  })
})

describe("brand-only saved searches", () => {
  const lostQuery = {
    isBrandOnly: true,
    brand: { id: LOST_ID, name: "Lost Surfboards" },
    sectionIntent: null,
  }

  it("rejects a different shaper even when the description says lost or last", () => {
    assert.equal(
      listingMatchesBrandOnlyQuery(
        {
          section: "surfboards",
          brand_id: "22222222-2222-4222-8222-222222222222",
          brand: "Allan Gibbons",
          title: "allan gibbons",
          model: null,
        },
        lostQuery,
      ),
      false,
    )
  })

  it("keeps a Lost board", () => {
    assert.equal(
      listingMatchesBrandOnlyQuery(
        {
          section: "surfboards",
          brand_id: LOST_ID,
          brand: "Lost Surfboards",
          title: "Puddle Jumper",
          model: "Puddle Jumper",
        },
        lostQuery,
      ),
      true,
    )
  })

  it("does not treat a non-brand query as brand inventory", () => {
    assert.equal(
      listingMatchesBrandOnlyQuery(
        { section: "surfboards", title: "allan gibbons", brand: "Allan Gibbons" },
        { isBrandOnly: false, brand: lostQuery.brand, sectionIntent: null },
      ),
      null,
    )
  })

  it("scopes channel islands fins to the fins section", () => {
    assert.equal(
      listingMatchesBrandOnlyQuery(
        {
          section: "surfboards",
          brand_id: LOST_ID,
          brand: "Channel Islands",
          title: "CI Twin",
        },
        {
          isBrandOnly: true,
          brand: { id: LOST_ID, name: "Channel Islands" },
          sectionIntent: "fins",
        },
      ),
      false,
    )
  })
})
