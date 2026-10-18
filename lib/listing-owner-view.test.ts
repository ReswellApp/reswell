import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { listingViewerIsOwner } from "./listing-owner-view.ts"

const OWNER = "11111111-1111-4111-8111-111111111111"

describe("listingViewerIsOwner", () => {
  it("matches only the seller id", () => {
    assert.equal(listingViewerIsOwner(OWNER, OWNER), true)
    assert.equal(listingViewerIsOwner(OWNER, "22222222-2222-4222-8222-222222222222"), false)
    assert.equal(listingViewerIsOwner(null, OWNER), false)
    assert.equal(listingViewerIsOwner(OWNER, null), false)
  })
})

describe("cached listing owner chrome", () => {
  const pages = [
    "surfboard-listing-detail-page.tsx",
    "fins-listing-detail-page.tsx",
    "wetsuits-listing-detail-page.tsx",
    "boardbags-listing-detail-page.tsx",
    "surfpacks-listing-detail-page.tsx",
    "leashes-listing-detail-page.tsx",
    "apparel-listing-detail-page.tsx",
    "accessories-listing-detail-page.tsx",
    "magazines-listing-detail-page.tsx",
    "traction-listing-detail-page.tsx",
  ]

  it("keeps seller copy and owner controls out of the server listing document", () => {
    for (const page of pages) {
      const source = readFileSync(new URL(`../components/${page}`, import.meta.url), "utf8")
      assert.doesNotMatch(source, /Reswell sellers protection/)
      assert.doesNotMatch(source, /viewerRole=\{isOwnListing/)
      assert.doesNotMatch(source, /<ListingOwnerManageActions[\s>]/)
      assert.doesNotMatch(source, /<ListingSoldOwnerNotice/)
      assert.match(source, /<ListingProtectionRibbonSlot/)
      assert.match(source, /<ListingOwnerHydratedManageActions/)
      assert.match(source, /<ListingBuyerOnly>/)
    }
  })

  it("renders owner controls from the browser session, not the shared HTML", () => {
    const slot = readFileSync(
      new URL("../components/features/listings/listing-protection-ribbon-slot.tsx", import.meta.url),
      "utf8",
    )
    const actions = readFileSync(
      new URL(
        "../components/features/listings/listing-owner-hydrated-manage-actions.tsx",
        import.meta.url,
      ),
      "utf8",
    )
    const buyerOnly = readFileSync(
      new URL("../components/features/listings/listing-buyer-only.tsx", import.meta.url),
      "utf8",
    )
    const provider = readFileSync(
      new URL("../components/features/listings/listing-viewer-provider.tsx", import.meta.url),
      "utf8",
    )
    assert.match(slot, /listingViewerIsOwner/)
    assert.match(slot, /viewerRole="seller"/)
    assert.match(slot, /viewerRole="buyer"/)
    assert.match(actions, /if \(!isOwner \|\| !userId\) return null/)
    assert.match(buyerOnly, /if \(isOwner\) return null/)
    assert.match(provider, /useLayoutEffect/)
    assert.match(provider, /readSupabaseBrowserUserId/)
    assert.doesNotMatch(
      readFileSync(
        new URL("../components/features/listings/listing-private-chrome-island.tsx", import.meta.url),
        "utf8",
      ),
      /ListingOwnerManageActionsView|ListingSoldOwnerNotice/,
    )
  })
})
