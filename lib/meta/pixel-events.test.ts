import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildMetaProductEventParams } from "./pixel-events.ts"

describe("buildMetaProductEventParams", () => {
  it("includes ISO currency whenever value is present", () => {
    assert.deepEqual(
      buildMetaProductEventParams({
        contentId: "listing-1",
        value: 450,
        currency: "$",
        contentName: "Board",
      }),
      {
        content_type: "product",
        content_ids: ["listing-1"],
        value: 450,
        currency: "USD",
        content_name: "Board",
      },
    )
  })

  it("omits value and currency when there is no amount", () => {
    assert.deepEqual(buildMetaProductEventParams({ contentId: "listing-1" }), {
      content_type: "product",
      content_ids: ["listing-1"],
    })
  })
})
