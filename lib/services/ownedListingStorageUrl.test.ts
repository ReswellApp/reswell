import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isOwnedListingStorageUrl } from "@/lib/services/ownedListingStorageUrl"

const USER_ID = "11111111-1111-4111-8111-111111111111"

describe("isOwnedListingStorageUrl", () => {
  it("accepts a public listings object under the seller folder", () => {
    const url = `https://xyzcompany.supabase.co/storage/v1/object/public/listings/${USER_ID}/photo-full.webp`
    assert.equal(isOwnedListingStorageUrl(url, USER_ID), true)
  })

  it("rejects another seller's object", () => {
    const url =
      "https://xyzcompany.supabase.co/storage/v1/object/public/listings/22222222-2222-4222-8222-222222222222/photo-full.webp"
    assert.equal(isOwnedListingStorageUrl(url, USER_ID), false)
  })

  it("rejects non-storage hosts", () => {
    assert.equal(isOwnedListingStorageUrl("https://cdn.example.com/photo.webp", USER_ID), false)
  })
})
