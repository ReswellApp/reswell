import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MobileSellVideo } from "@reswell/api-contract"
import { mobileSellVideoInputError } from "@/lib/services/mobileSellVideoInput"

const USER = "11111111-1111-4111-8111-111111111111"

function video(overrides: Partial<MobileSellVideo> = {}): MobileSellVideo {
  return {
    url: `https://example.supabase.co/storage/v1/object/public/listings/${USER}/clip.mp4`,
    thumbnail_url: null,
    content_type: "video/mp4",
    duration_seconds: 12,
    byte_size: 1_000_000,
    ...overrides,
  }
}

describe("mobileSellVideoInputError", () => {
  it("accepts an owned mp4 in range", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    try {
      assert.equal(mobileSellVideoInputError(video(), USER), null)
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })

  it("rejects a clip under 6 seconds", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    try {
      assert.match(mobileSellVideoInputError(video({ duration_seconds: 3 }), USER) ?? "", /at least 6 seconds/)
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })

  it("rejects a clip over 2 minutes", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    try {
      assert.match(mobileSellVideoInputError(video({ duration_seconds: 181 }), USER) ?? "", /up to 2 minutes/)
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })

  it("rejects a file over 200MB", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    try {
      assert.match(
        mobileSellVideoInputError(video({ byte_size: 201 * 1024 * 1024 }), USER) ?? "",
        /over 200MB/,
      )
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })

  it("rejects a URL outside the seller's listings prefix", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    try {
      assert.equal(
        mobileSellVideoInputError(
          video({ url: "https://example.supabase.co/storage/v1/object/public/listings/other/clip.mp4" }),
          USER,
        ),
        "Upload the listing video again",
      )
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous
    }
  })
})
