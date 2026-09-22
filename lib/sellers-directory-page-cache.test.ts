import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("sellers directory cache constraints", () => {
  it("does not read the session or follow rows on the RSC path", () => {
    const src = readFileSync(new URL("../app/sellers/page.tsx", import.meta.url), "utf8")
    assert.doesNotMatch(src, /from\s+["']@\/lib\/supabase\/server["']/)
    assert.doesNotMatch(src, /\.from\(\s*["']seller_follows["']/)
    assert.doesNotMatch(src, /auth\.getUser\(/)
    assert.match(src, /SellersDirectoryViewerProvider/)
    assert.match(src, /SellersDirectoryGuestSellCta/)
    assert.doesNotMatch(src, /searchParams/)
    assert.match(src, /Suspense/)
  })

  it("hydrates follow state in the client after the shared document renders", () => {
    const viewer = readFileSync(
      new URL("../components/sellers/sellers-directory-viewer.tsx", import.meta.url),
      "utf8",
    )
    assert.match(viewer, /from\s+["']@\/lib\/supabase\/client["']/)
    assert.match(viewer, /\.from\(\s*["']seller_follows["']/)
    assert.match(viewer, /auth\.getUser\(/)

    const follow = readFileSync(
      new URL("../components/sellers/seller-directory-tile-follow.tsx", import.meta.url),
      "utf8",
    )
    assert.match(follow, /useSellersDirectoryViewer/)
    assert.doesNotMatch(follow, /isLoggedIn:/)
    assert.doesNotMatch(follow, /initialFollowing:/)
  })

  it("serves directory mosaics from the film derivative", () => {
    const src = readFileSync(
      new URL("../lib/sellers/directory-mosaic-images.ts", import.meta.url),
      "utf8",
    )
    assert.match(src, /listingFilmImageSrcFromRow/)
    assert.doesNotMatch(src, /listingCardImageSrc/)
  })
})
