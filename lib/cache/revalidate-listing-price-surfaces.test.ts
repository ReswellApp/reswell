import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("listing price cache revalidation", () => {
  it("expires the hourly /l Data Cache after an owned listing save", () => {
    const src = readFileSync(
      new URL("../../app/api/listings/[id]/owned-edit/route.ts", import.meta.url),
      "utf8",
    )
    assert.match(src, /revalidateAfterListingWrite/)
  })

  it("expires the hourly /l Data Cache from gear listing mutations", () => {
    const src = readFileSync(
      new URL("./revalidate-listing-mutation-paths.ts", import.meta.url),
      "utf8",
    )
    assert.match(src, /revalidateListingDetailPage/)
    assert.doesNotMatch(src, /revalidatePath\(`\/l\/\$\{trimmed\}`\)/)
  })

  it("overlays live list price on the public PDP body", () => {
    const src = readFileSync(
      new URL(
        "../../components/features/listings/listing-detail-public-body.tsx",
        import.meta.url,
      ),
      "utf8",
    )
    assert.match(src, /overlayListingPublicCommerceFields/)
  })

  it("busts shop and PDP caches together after a listing write", () => {
    const src = readFileSync(
      new URL("./revalidate-after-listing-write.ts", import.meta.url),
      "utf8",
    )
    assert.match(src, /revalidateSellersAfterListingChange/)
    assert.match(src, /revalidateListingDetailPage/)
    assert.match(src, /revalidateBoardsBrowseCatalog/)
  })
})
