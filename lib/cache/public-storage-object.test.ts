import assert from "node:assert/strict"
import { register } from "node:module"
import { after, describe, it } from "node:test"
/**
 * `export { NAME } from` does not create a local binding. Brand-asset loaders
 * use this prefix inside `unstable_cache`'s key, so it has to be imported
 * in `public-storage-object.ts` — a re-export alone throws
 * `PUBLIC_STORAGE_OBJECT_CACHE_TAG_PREFIX is not defined`.
 */
const CACHE_KEY = Symbol.for("reswell.publicStorageObjectCacheKey")

const metaHref = new URL("./public-storage-object-meta.ts", import.meta.url).href
const stubHref =
  "data:text/javascript," +
  encodeURIComponent(
    `export function unstable_cache(_fn, key) {
      globalThis[Symbol.for("reswell.publicStorageObjectCacheKey")] = key
      return async () => ({ bodyBase64: "d2VicA==", contentType: "image/webp" })
    }`,
  )

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/cache") {
    return { url: ${JSON.stringify(stubHref)}, shortCircuit: true }
  }
  if (specifier === "@/lib/cache/public-storage-object-meta") {
    return { url: ${JSON.stringify(metaHref)}, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

const originalFetch = globalThis.fetch
const fetchCalls: Array<{ url: string; cache?: RequestCache }> = []

globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  fetchCalls.push({
    url: String(url),
    cache: init?.cache,
  })
  return new Response(Buffer.from("webp"), {
    status: 200,
    headers: { "content-type": "image/webp" },
  })
}) as typeof fetch

after(() => {
  globalThis.fetch = originalFetch
})

const storageModule = await import("./public-storage-object.ts")

describe("getCachedPublicStorageObject", () => {
  it("does not put listing photos in the Next.js Data Cache", async () => {
    fetchCalls.length = 0
    globalThis[CACHE_KEY] = undefined

    const result = await storageModule.getCachedPublicStorageObject(
      "listings",
      "user/1-full.webp",
      "https://example.test/listings/user/1-full.webp",
    )

    assert.equal(globalThis[CACHE_KEY], undefined)
    assert.equal(result?.contentType, "image/webp")
    assert.equal(fetchCalls.length, 1)
    assert.equal(fetchCalls[0]?.cache, "no-store")
  })

  it("uses the imported cache-tag prefix for brand logos", async () => {
    await storageModule.getCachedPublicStorageObject(
      "brand-assets",
      "logo.webp",
      "https://example.test/brands/logo.webp",
    )

    assert.deepEqual(globalThis[CACHE_KEY], [
      "public-storage-object",
      "brand-assets",
      "logo.webp",
      "until-revalidate",
    ])
  })
})
