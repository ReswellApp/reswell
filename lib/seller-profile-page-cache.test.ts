import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("seller profile cache constraints", () => {
  it("does not read the session, follows, or favorites on the RSC path", () => {
    const src = readFileSync(new URL("../app/sellers/[slug]/page.tsx", import.meta.url), "utf8")
    assert.doesNotMatch(src, /from\s+["']@\/lib\/supabase\/server["']/)
    assert.doesNotMatch(src, /auth\.getUser\(/)
    assert.doesNotMatch(src, /\.from\(\s*["']seller_follows["']/)
    assert.doesNotMatch(src, /\.from\(\s*["']favorites["']/)
    assert.match(src, /createAnonSupabaseClient/)
    assert.match(src, /SellerProfileViewerProvider/)
    assert.match(src, /export const revalidate = 3600/)
  })

  it("hydrates follow state and favorites in the client", () => {
    const viewer = readFileSync(
      new URL("../components/sellers/seller-profile-viewer.tsx", import.meta.url),
      "utf8",
    )
    assert.match(viewer, /from\s+["']@\/lib\/supabase\/client["']/)
    assert.match(viewer, /\.from\(\s*["']seller_follows["']/)
    assert.match(viewer, /\.from\(\s*["']favorites["']/)
    assert.match(viewer, /auth\.getUser\(/)

    const view = readFileSync(
      new URL("../components/sellers/seller-profile-view.tsx", import.meta.url),
      "utf8",
    )
    assert.match(view, /useSellerProfileViewer/)
  })
})
