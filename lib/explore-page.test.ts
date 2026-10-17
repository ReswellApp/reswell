import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { EXPLORE_PATH, exploreBoardShapeLinks, exploreDestinations } from "./explore-page.ts"

describe("explore page destinations", () => {
  it("uses a stable public path", () => {
    assert.equal(EXPLORE_PATH, "/explore")
  })

  it("keeps unique, internal destination hrefs", () => {
    const hrefs = exploreDestinations.map((destination) => destination.href)
    assert.equal(new Set(hrefs).size, hrefs.length)
    for (const href of hrefs) {
      assert.equal(href.startsWith("/"), true, href)
      assert.equal(href.startsWith("//"), false, href)
    }
  })

  it("lists board shapes without repeating the surfboards root", () => {
    assert.ok(exploreBoardShapeLinks.length > 0)
    assert.equal(
      exploreBoardShapeLinks.some((link) => link.href === "/boards"),
      false,
    )
  })
})
