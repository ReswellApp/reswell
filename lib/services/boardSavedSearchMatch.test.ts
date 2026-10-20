import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingListedAfterSavedSearch } from "./boardSavedSearchAlertWindow.ts"
import { savedSearchBrandAndModelMatch } from "./savedSearchBrandModelMatch.ts"

const BRAND_ID = "11111111-1111-4111-8111-111111111111"
const MODEL_ID = "22222222-2222-4222-8222-222222222222"

describe("listingListedAfterSavedSearch", () => {
  it("allows a board first published after the search was saved", () => {
    assert.equal(
      listingListedAfterSavedSearch("2026-10-16T18:00:00.000Z", "2026-10-16T17:00:00.000Z"),
      true,
    )
  })

  it("rejects a board that was already listed when the search was saved", () => {
    assert.equal(
      listingListedAfterSavedSearch("2026-10-01T18:00:00.000Z", "2026-10-16T17:00:00.000Z"),
      false,
    )
  })

  it("rejects a missing publish time", () => {
    assert.equal(listingListedAfterSavedSearch(null, "2026-10-16T17:00:00.000Z"), false)
  })
})

describe("savedSearchBrandAndModelMatch", () => {
  const channelIslands = {
    brand: "Channel Islands",
    model: "Neck Beard",
    title: "Channel Islands Neck Beard",
    brand_id: BRAND_ID,
    brand_model_id: null,
  }

  it("matches a directory brand plus a typed model that is not in the catalog", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(channelIslands, {
        brandId: BRAND_ID,
        brand: "Channel Islands",
        model: "Neck Beard",
      }),
      true,
    )
  })

  it("rejects a typed model that does not match, even when the brand id does", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(channelIslands, {
        brandId: BRAND_ID,
        model: "Dumpster Diver",
      }),
      false,
    )
  })

  it("matches freeform brand and model text when neither is a catalog row", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(
        {
          brand: "Small Shaper",
          model: "Daily Driver",
          title: "Daily Driver",
          brand_id: null,
          brand_model_id: null,
        },
        { brand: "small shaper", model: "daily" },
      ),
      true,
    )
  })

  it("uses the catalog model id and does not also require the typed model string", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(
        { ...channelIslands, brand_model_id: MODEL_ID },
        { brandId: BRAND_ID, brandModelId: MODEL_ID, model: "Some Other Name" },
      ),
      true,
    )
  })

  it("matches punctuation, spacing, and a known short alias", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(channelIslands, { brand: "channelislands", model: "neckbeard" }),
      true,
    )
    assert.equal(
      savedSearchBrandAndModelMatch(
        { brand: "Channel Islands Surfboards", model: "Neck Beard", title: "Neck Beard" },
        { brand: "CI", model: "Neck Beard" },
      ),
      true,
    )
  })

  it("matches Lost and Mayhem as the same shaper", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(
        { brand: "Lost Surfboards", model: "Puddle Jumper", title: "Puddle Jumper" },
        { brand: "Mayhem", model: "Puddle Jumper" },
      ),
      true,
    )
    assert.equal(
      savedSearchBrandAndModelMatch(
        { brand: "Lost by Mayhem", model: "Driver", title: "Driver" },
        { brand: "Lost", model: "Driver" },
      ),
      true,
    )
  })

  it("does not treat a different shaper that contains an alias word as that alias", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(
        { brand: "Lost Coast", model: "Daily", title: "Daily" },
        { brand: "Mayhem", model: "Daily" },
      ),
      false,
    )
  })

  it("does not treat a short fragment as a brand", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(
        { brand: "Album Surf", model: "Round", title: "Album Round" },
        { brand: "al", model: "Round" },
      ),
      false,
    )
  })

  it("matches an unlinked listing when the directory brand text is the same shaper", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(
        { ...channelIslands, brand_id: null },
        { brandId: BRAND_ID, brand: "Channel Islands", model: "Neck Beard" },
      ),
      true,
    )
  })

  it("rejects a different catalog brand even when the typed name matches", () => {
    assert.equal(
      savedSearchBrandAndModelMatch(channelIslands, {
        brandId: "33333333-3333-4333-8333-333333333333",
        brand: "Channel Islands",
        model: "Neck Beard",
      }),
      false,
    )
  })
})
