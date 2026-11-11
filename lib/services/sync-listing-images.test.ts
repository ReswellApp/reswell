import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  listingImageRowsMatchPayload,
  listingImagesNeedingStorageVerify,
  type ListingImageSyncRow,
  type ListingImageUpdateOp,
} from "./listing-image-sync-diff.ts"

function row(
  overrides: Partial<ListingImageSyncRow> & Pick<ListingImageSyncRow, "id">,
): ListingImageSyncRow {
  return {
    sort_order: 0,
    is_primary: true,
    url: "https://example.supabase.co/storage/v1/object/public/listings/u/a-full.jpg",
    thumbnail_url: "https://example.supabase.co/storage/v1/object/public/listings/u/a-thumb.jpg",
    ...overrides,
  }
}

function op(
  overrides: Partial<ListingImageUpdateOp> & Pick<ListingImageUpdateOp, "url">,
): ListingImageUpdateOp {
  return {
    isPrimary: true,
    sortOrder: 0,
    thumbnailUrl: "https://example.supabase.co/storage/v1/object/public/listings/u/a-thumb.jpg",
    ...overrides,
  }
}

describe("listingImageRowsMatchPayload", () => {
  it("matches when every existing row already equals the payload", () => {
    const existing = [row({ id: "img-1" })]
    const images = [op({ id: "img-1", url: existing[0]!.url, thumbnailUrl: existing[0]!.thumbnail_url })]
    assert.equal(listingImageRowsMatchPayload(existing, images, []), true)
  })

  it("does not match when a photo is only identified by URL", () => {
    const existing = [row({ id: "img-1" })]
    const images = [op({ url: existing[0]!.url, thumbnailUrl: existing[0]!.thumbnail_url })]
    assert.equal(listingImageRowsMatchPayload(existing, images, []), false)
  })

  it("does not match when sort order changed", () => {
    const existing = [
      row({ id: "img-1", sort_order: 0, is_primary: true }),
      row({
        id: "img-2",
        sort_order: 1,
        is_primary: false,
        url: "https://example.supabase.co/storage/v1/object/public/listings/u/b-full.jpg",
        thumbnail_url: "https://example.supabase.co/storage/v1/object/public/listings/u/b-thumb.jpg",
      }),
    ]
    const images = [
      op({
        id: "img-2",
        url: existing[1]!.url,
        thumbnailUrl: existing[1]!.thumbnail_url,
        isPrimary: true,
        sortOrder: 0,
      }),
      op({
        id: "img-1",
        url: existing[0]!.url,
        thumbnailUrl: existing[0]!.thumbnail_url,
        isPrimary: false,
        sortOrder: 1,
      }),
    ]
    assert.equal(listingImageRowsMatchPayload(existing, images, []), false)
  })
})

describe("listingImagesNeedingStorageVerify", () => {
  it("skips existing photos whose files already match", () => {
    const existing = row({ id: "img-1" })
    const needed = listingImagesNeedingStorageVerify(
      new Map([[existing.id, existing]]),
      [op({ id: "img-1", url: existing.url, thumbnailUrl: existing.thumbnail_url })],
    )
    assert.deepEqual(needed, [])
  })

  it("verifies new photos and photos whose URL changed", () => {
    const existing = row({ id: "img-1" })
    const newPhoto = op({
      url: "https://example.supabase.co/storage/v1/object/public/listings/u/new-full.jpg",
      thumbnailUrl: "https://example.supabase.co/storage/v1/object/public/listings/u/new-thumb.jpg",
    })
    const replaced = op({
      id: "img-1",
      url: "https://example.supabase.co/storage/v1/object/public/listings/u/replaced-full.jpg",
      thumbnailUrl: "https://example.supabase.co/storage/v1/object/public/listings/u/replaced-thumb.jpg",
    })
    const needed = listingImagesNeedingStorageVerify(
      new Map([[existing.id, existing]]),
      [replaced, newPhoto],
    )
    assert.deepEqual(
      needed.map((img) => img.url),
      [replaced.url, newPhoto.url],
    )
  })
})

describe("syncListingImages save path", () => {
  it("claims existing rows before deleting, so an unchanged gallery skips storage HEAD", () => {
    const src = readFileSync(new URL("./sync-listing-images.ts", import.meta.url), "utf8")
    const body = src.slice(src.indexOf("export async function syncListingImages"))
    const assignAt = body.indexOf("assignListingImageIdsFromExistingUrls(")
    const matchAt = body.indexOf("listingImageRowsMatchPayload(")
    const verifyAt = body.indexOf("listingImagesNeedingStorageVerify(")
    const deleteAt = body.indexOf("deleteListingMediaRowsThenStorage(")
    assert.ok(assignAt > -1)
    assert.ok(matchAt > assignAt)
    assert.ok(verifyAt > matchAt)
    assert.ok(deleteAt > verifyAt)
  })
})
