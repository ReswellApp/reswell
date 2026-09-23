import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_STORED_DERIVATIVE_UPLOADS_SINCE_MS,
  isDurableListingDerivativeMiss,
  listingDerivativePredatesStoredUploads,
  probeListingStoredDerivative,
} from "./listing-stored-derivative.ts"


const PRE_DEPLOY =
  "ab98fbb1-0c49-49e1-9483-a1c4a286c8e2/1790025096240-d2e0f3e2-5df7-49a6-9030-86fcad057c7d-film2.jpg"

describe("listingDerivativePredatesStoredUploads", () => {
  it("treats names minted before the card2/film2 deploy as permanent misses", () => {
    assert.ok(1790025096240 < LISTING_STORED_DERIVATIVE_UPLOADS_SINCE_MS)
    assert.equal(listingDerivativePredatesStoredUploads(PRE_DEPLOY), true)
  })

  it("still looks up derivatives uploaded after the deploy", () => {
    const file = `${LISTING_STORED_DERIVATIVE_UPLOADS_SINCE_MS}-d2e0f3e2-5df7-49a6-9030-86fcad057c7d-card2.webp`
    assert.equal(listingDerivativePredatesStoredUploads(`user/${file}`), false)
  })

  it("does not guess for import filenames that have no upload timestamp", () => {
    assert.equal(
      listingDerivativePredatesStoredUploads("user/import-1710000000000-0-card2.jpg"),
      false,
    )
  })
})

describe("isDurableListingDerivativeMiss", () => {
  it("counts Storage's not-found statuses and leaves other failures uncached", () => {
    assert.equal(isDurableListingDerivativeMiss(400), true)
    assert.equal(isDurableListingDerivativeMiss(404), true)
    assert.equal(isDurableListingDerivativeMiss(200), false)
    assert.equal(isDurableListingDerivativeMiss(403), false)
    assert.equal(isDurableListingDerivativeMiss(500), false)
  })
})

describe("probeListingStoredDerivative", () => {
  it("stops after a 400 HEAD and does not download the missing object", async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls.push(init?.method ?? "GET")
      return new Response(null, { status: 400 })
    }

    const result = await probeListingStoredDerivative(
      "https://proj.supabase.co/storage/v1/object/public/listings/u/1-card2.jpg",
      fetchImpl,
    )

    assert.deepEqual(result, { state: "missing" })
    assert.deepEqual(calls, ["HEAD"])
  })

  it("downloads a present derivative once", async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (_url, init) => {
      const method = init?.method ?? "GET"
      calls.push(method)
      if (method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: { "content-length": "4", "content-type": "image/webp" },
        })
      }
      return new Response(Buffer.from("webp"), {
        status: 200,
        headers: { "content-type": "image/webp" },
      })
    }

    const result = await probeListingStoredDerivative("https://example.test/card2.webp", fetchImpl)
    assert.equal(result.state, "present")
    if (result.state === "present") {
      assert.equal(Buffer.from(result.bodyBase64, "base64").toString(), "webp")
      assert.equal(result.contentType, "image/webp")
    }
    assert.deepEqual(calls, ["HEAD", "GET"])
  })

  it("does not download a derivative that is too large for the data cache", async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls.push(init?.method ?? "GET")
      return new Response(null, {
        status: 200,
        headers: { "content-length": String(3 * 1024 * 1024) },
      })
    }

    const result = await probeListingStoredDerivative("https://example.test/card2.webp", fetchImpl)
    assert.deepEqual(result, { state: "oversize" })
    assert.deepEqual(calls, ["HEAD"])
  })

  it("does not cache a Storage 500 as a miss", async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 500 })
    await assert.rejects(
      () => probeListingStoredDerivative("https://example.test/card2.webp", fetchImpl),
      /probe failed \(500\)/,
    )
  })
})
