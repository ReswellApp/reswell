import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assignListingImageIdsFromExistingUrls,
  isListingImageUniqueViolation,
  listingImageUrlsEquivalent,
} from "./listing-image-identity.ts"

const STORAGE = "https://proj.supabase.co/storage/v1/object/public/listings/user/photo-full.webp"

describe("listingImageUrlsEquivalent", () => {
  it("treats a public storage URL and its media proxy as the same photo", () => {
    assert.equal(
      listingImageUrlsEquivalent(STORAGE, "/media/listings/user/photo-full.webp"),
      true,
    )
  })

  it("keeps a different upload as a different photo", () => {
    assert.equal(
      listingImageUrlsEquivalent(STORAGE, STORAGE.replace("photo-full", "other-full")),
      false,
    )
  })
})

describe("assignListingImageIdsFromExistingUrls", () => {
  it("claims an existing row when publish does not know the id yet", () => {
    const result = assignListingImageIdsFromExistingUrls(
      [
        { id: "row-1", url: STORAGE },
        { id: "row-2", url: STORAGE },
      ],
      [{ url: STORAGE, sortOrder: 0 }],
    )

    assert.equal(result.images[0]?.id, "row-1")
    assert.deepEqual(result.duplicateRowIds, ["row-2"])
  })

  it("replaces a stale id with the row that already has this photo", () => {
    const result = assignListingImageIdsFromExistingUrls(
      [{ id: "row-live", url: STORAGE }],
      [{ id: "row-gone", url: STORAGE }],
    )

    assert.equal(result.images[0]?.id, "row-live")
    assert.deepEqual(result.duplicateRowIds, [])
  })

  it("does not reuse a row already referenced by another photo", () => {
    const result = assignListingImageIdsFromExistingUrls(
      [{ id: "row-1", url: STORAGE }],
      [
        { id: "row-1", url: STORAGE },
        { url: STORAGE },
      ],
    )

    assert.equal(result.images[1]?.id, undefined)
    assert.deepEqual(result.duplicateRowIds, [])
  })
})

describe("isListingImageUniqueViolation", () => {
  it("recognizes the listing image unique index", () => {
    assert.equal(isListingImageUniqueViolation({ code: "23505" }), true)
    assert.equal(
      isListingImageUniqueViolation({
        message:
          'duplicate key value violates unique constraint "listing_images_listing_id_url_key"',
      }),
      true,
    )
    assert.equal(isListingImageUniqueViolation({ message: "permission denied" }), false)
  })
})
