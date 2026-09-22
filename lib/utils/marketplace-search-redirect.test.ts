import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { marketplaceSearchRedirect } from "./marketplace-search-redirect.ts"

describe("marketplaceSearchRedirect", () => {
  it("sends empty /search to recent listings", () => {
    assert.deepEqual(marketplaceSearchRedirect({ rawQuery: "", brandSlug: "", categorySlug: "" }), {
      href: "/search/recent",
      permanent: true,
    })
  })

  it("keeps category on the empty-search redirect", () => {
    assert.deepEqual(
      marketplaceSearchRedirect({ rawQuery: "  ", brandSlug: "", categorySlug: " fins " }),
      {
        href: "/search/recent?category=fins",
        permanent: true,
      },
    )
  })

  it("does not bounce a brand-directory URL to recent", () => {
    assert.equal(
      marketplaceSearchRedirect({
        rawQuery: "",
        brandSlug: "lost-surfboards",
        categorySlug: "",
      }),
      null,
    )
  })

  it("sends bare section keywords to the section hub", () => {
    assert.deepEqual(
      marketplaceSearchRedirect({ rawQuery: "fins", brandSlug: "", categorySlug: "" }),
      { href: "/fins", permanent: false },
    )
  })

  it("uses the injected style resolver for bare board styles", () => {
    assert.deepEqual(
      marketplaceSearchRedirect(
        { rawQuery: "fish", brandSlug: "", categorySlug: "" },
        (q) => `/boards?type=${q}&q=${q}`,
      ),
      { href: "/boards?type=fish&q=fish", permanent: false },
    )
  })

  it("leaves normal listing queries on /search", () => {
    assert.equal(
      marketplaceSearchRedirect({ rawQuery: "lost", brandSlug: "", categorySlug: "" }),
      null,
    )
  })
})
