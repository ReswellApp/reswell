import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingItemListSchema } from "./structured-data.ts"

describe("listingItemListSchema", () => {
  it("puts each board on its listing URL", () => {
    const node = listingItemListSchema("Recently listed on Reswell", [
      {
        name: "6'0 Chris Christenson Lane Splitter",
        url: "https://www.reswell.app/l/60-chris-christenson-lane-splitter",
      },
    ])
    assert.ok(node)
    const elements = node.itemListElement as Array<Record<string, unknown>>
    assert.equal(elements.length, 1)
    assert.equal(elements[0]?.url, "https://www.reswell.app/l/60-chris-christenson-lane-splitter")
    const item = elements[0]?.item as Record<string, unknown>
    assert.equal(item.url, "https://www.reswell.app/l/60-chris-christenson-lane-splitter")
    assert.equal(item["@type"], "Product")
  })

  it("drops blank names and non-https urls", () => {
    assert.equal(
      listingItemListSchema("Recently listed on Reswell", [
        { name: " ", url: "https://www.reswell.app/l/ok" },
        { name: "Board", url: "/l/relative" },
      ]),
      null,
    )
  })
})
