import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  CATEGORY_BROWSE_PATHNAMES,
  isCategoryBrowsePathname,
  shouldSkipPageEnterAnimation,
} from "./site-category-browse-paths.ts"

describe("isCategoryBrowsePathname", () => {
  it("matches surfboard and peer category browse roots", () => {
    assert.equal(isCategoryBrowsePathname("/boards"), true)
    assert.equal(isCategoryBrowsePathname("/fins"), true)
    assert.equal(isCategoryBrowsePathname("/wetsuits"), true)
    assert.equal(isCategoryBrowsePathname("/magazines"), true)
    assert.equal(isCategoryBrowsePathname("/traction"), true)
    assert.equal(isCategoryBrowsePathname("/boards/"), true)
  })

  it("does not treat listing, search, or home routes as category browse", () => {
    assert.equal(isCategoryBrowsePathname("/l/some-board"), false)
    assert.equal(isCategoryBrowsePathname("/search"), false)
    assert.equal(isCategoryBrowsePathname("/"), false)
    assert.equal(isCategoryBrowsePathname("/sellers"), false)
    assert.equal(isCategoryBrowsePathname(null), false)
  })

  it("stays aligned with category hrefs in the header directory", () => {
    const src = readFileSync(new URL("./site-category-directory.ts", import.meta.url), "utf8")
    for (const pathname of CATEGORY_BROWSE_PATHNAMES) {
      assert.equal(src.includes(`href: "${pathname}"`), true, pathname)
    }
  })
})

describe("shouldSkipPageEnterAnimation", () => {
  it("skips the enter on listing PDPs and category browse pages", () => {
    assert.equal(shouldSkipPageEnterAnimation("/l/lost-round-nose"), true)
    assert.equal(shouldSkipPageEnterAnimation("/l"), true)
    assert.equal(shouldSkipPageEnterAnimation("/boards"), true)
    assert.equal(shouldSkipPageEnterAnimation("/fins"), true)
    assert.equal(shouldSkipPageEnterAnimation("/apparel"), true)
    assert.equal(shouldSkipPageEnterAnimation("/magazines"), true)
  })

  it("still allows the enter animation on other marketing and account routes", () => {
    assert.equal(shouldSkipPageEnterAnimation("/"), false)
    assert.equal(shouldSkipPageEnterAnimation("/search"), false)
    assert.equal(shouldSkipPageEnterAnimation("/sell/boards"), false)
    assert.equal(shouldSkipPageEnterAnimation("/dashboard"), false)
  })
})

describe("root-level page-enter wiring", () => {
  it("gates page-enter from NavigationPageGate via the shared helper", () => {
    const src = readFileSync(new URL("../components/navigation-page-gate.tsx", import.meta.url), "utf8")
    assert.match(src, /shouldSkipPageEnterAnimation/)
    assert.doesNotMatch(src, /!pathname\.startsWith\("\/l\/"\) && "page-enter"/)
  })

  it("uses the category browse skeleton from root loading.tsx", () => {
    const src = readFileSync(new URL("../components/root-route-loading.tsx", import.meta.url), "utf8")
    assert.match(src, /isCategoryBrowsePathname/)
    assert.match(src, /BoardsBrowsePageSkeleton/)
    assert.match(src, /from ["']@\/lib\/site-category-browse-paths["']/)
  })

  it("does not fade page-enter from opacity 0", () => {
    const src = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const block = src.slice(src.indexOf("@keyframes page-enter"), src.indexOf(".page-enter"))
    assert.match(block, /translateY\(6px\)/)
    assert.doesNotMatch(block, /opacity:\s*0/)
  })
})
