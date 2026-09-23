import {
  PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES,
  type CachedPublicStorageObject,
} from "../cache/public-storage-object-meta.ts"

/**
 * `card2` / `film2` uploads shipped in ea3868be (2026-09-22 14:34:45 -0700).
 * Filenames minted earlier only have `full`, so asking Storage for the derived
 * name is a guaranteed miss.
 */
export const LISTING_STORED_DERIVATIVE_UPLOADS_SINCE_MS = Date.parse("2026-09-22T21:34:45.000Z")

export type ListingStoredDerivative =
  | { state: "missing" }
  | { state: "present"; bodyBase64: string; contentType: string }
  | { state: "oversize" }

/** Storage reports a missing object as HTTP 400 with `NoSuchKey` (404 is the real status). */
export function isDurableListingDerivativeMiss(status: number): boolean {
  return status === 400 || status === 404
}

/**
 * True when `objectPath` is a `card2`/`film2` name from before stored derivatives
 * existed. Those objects are never uploaded, so the media route resizes `full`
 * without a Storage lookup.
 */
export function listingDerivativePredatesStoredUploads(objectPath: string): boolean {
  const file = objectPath.split("/").pop() ?? ""
  const match = /^(\d{13})-/.exec(file)
  if (!match) return false
  const uploadedAt = Number(match[1])
  return Number.isFinite(uploadedAt) && uploadedAt < LISTING_STORED_DERIVATIVE_UPLOADS_SINCE_MS
}

function contentTypeFrom(res: Response): string {
  return res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream"
}

/**
 * One HEAD. A 400/404 is a durable miss and is not followed by a GET.
 * Throws on transport errors and 5xx so the caller does not cache a blip.
 */
export async function probeListingStoredDerivative(
  upstreamUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ListingStoredDerivative> {
  let head: Response
  try {
    head = await fetchImpl(upstreamUrl, {
      method: "HEAD",
      headers: { Accept: "image/*" },
      cache: "no-store",
    })
  } catch (err) {
    throw err instanceof Error ? err : new Error("listing derivative probe failed")
  }

  if (isDurableListingDerivativeMiss(head.status)) return { state: "missing" }
  if (!head.ok) throw new Error(`listing derivative probe failed (${head.status})`)

  const declared = Number.parseInt(head.headers.get("content-length") ?? "", 10)
  if (Number.isFinite(declared) && declared > PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES) {
    return { state: "oversize" }
  }

  const res = await fetchImpl(upstreamUrl, {
    headers: { Accept: "image/*" },
    cache: "no-store",
  })
  if (isDurableListingDerivativeMiss(res.status)) return { state: "missing" }
  if (!res.ok) throw new Error(`listing derivative fetch failed (${res.status})`)

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > PUBLIC_STORAGE_DATA_CACHE_MAX_RAW_BYTES) return { state: "oversize" }
  return {
    state: "present",
    bodyBase64: buf.toString("base64"),
    contentType: contentTypeFrom(res),
  }
}

export function listingStoredDerivativeObject(
  derivative: Extract<ListingStoredDerivative, { state: "present" }>,
): CachedPublicStorageObject {
  return { bodyBase64: derivative.bodyBase64, contentType: derivative.contentType }
}
