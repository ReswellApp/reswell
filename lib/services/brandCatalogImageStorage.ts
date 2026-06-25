import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import sharp from "sharp"
import { brandAssetsStorageObjectPathFromUrl } from "@/lib/brand-media-proxy-url"
import { catalogImageDedupeKey } from "@/lib/utils/catalog-image-url"
import { isAbortError } from "@/lib/utils/is-abort-error"

export const BRAND_ASSETS_BUCKET = "brand-assets" as const

export type BrandCatalogImageKind = "model" | "variant"

const MIN_IMAGE_BYTES = 80

const IMAGE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  Referer: "https://www.reswell.app/",
  "Sec-Fetch-Dest": "image",
  "Sec-Fetch-Mode": "no-cors",
  "Sec-Fetch-Site": "cross-site",
} as const

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/")
}

export function brandAssetsObjectPublicUrl(supabaseUrl: string, pathInBucket: string): string {
  const base = supabaseUrl.replace(/\/$/, "")
  return `${base}/storage/v1/object/public/${BRAND_ASSETS_BUCKET}/${encodeObjectPath(pathInBucket)}`
}

/** True when the URL already points at our `brand-assets` bucket (or `/media/brands/` proxy). */
export function isBrandCatalogImageMirrored(url: string | null | undefined): boolean {
  const t = url?.trim()
  if (!t) return false
  if (t.startsWith("/media/brands/")) return true
  return brandAssetsStorageObjectPathFromUrl(t) != null
}

/** Remote HTTP(S) catalog image that still needs mirroring into Supabase Storage. */
export function isExternalBrandCatalogImageUrl(url: string | null | undefined): boolean {
  const extracted = extractFirstHttpImageUrl(url)
  if (!extracted) return false
  if (isBrandCatalogImageMirrored(extracted)) return false
  return isValidHttpImageSource(extracted)
}

function extensionFromContentType(contentType: string | null): string {
  const ct = (contentType ?? "").toLowerCase()
  if (ct.includes("webp")) return "webp"
  if (ct.includes("png")) return "png"
  if (ct.includes("gif")) return "gif"
  if (ct.includes("avif")) return "avif"
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg"
  return "jpg"
}

/** Pull the first https URL out of messy CSV/scrape values (markdown, multi-line, labels). */
export function extractFirstHttpImageUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  if (/^https?:\/\//i.test(t)) {
    const first = t.split(/\s+/).find((part) => /^https?:\/\//i.test(part))
    return first?.replace(/[)\]},.]+$/, "") ?? t.split(/\s+/)[0] ?? null
  }
  const match = t.match(/https?:\/\/[^\s)\]"']+/i)
  return match?.[0]?.replace(/[)\]},.]+$/, "") ?? null
}

export function isValidHttpImageSource(url: string | null | undefined): url is string {
  const extracted = extractFirstHttpImageUrl(url)
  if (!extracted) return false
  try {
    const u = new URL(extracted)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}

async function normalizeImageBytes(
  bytes: Buffer,
  contentType: string | null,
): Promise<{ body: Buffer; ext: string; mime: string }> {
  const ct = (contentType ?? "").toLowerCase()
  const needsConvert = ct.includes("avif") || ct.includes("gif") || ct.includes("svg")

  if (!needsConvert) {
    const ext = extensionFromContentType(contentType) ?? "jpg"
    const mime = contentType?.split(";")[0]?.trim() || `image/${ext === "jpg" ? "jpeg" : ext}`
    return { body: bytes, ext, mime }
  }

  const webp = await sharp(bytes).webp({ quality: 88 }).toBuffer()
  return { body: webp, ext: "webp", mime: "image/webp" }
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const match = pathname.match(/\.(webp|jpe?g|png|gif)(?:$|[?#])/i)
    if (!match?.[1]) return null
    const ext = match[1].replace("jpeg", "jpg")
    return ext
  } catch {
    return null
  }
}

function storagePathForMirroredImage(
  sourceUrl: string,
  kind: BrandCatalogImageKind,
  ext: string,
): string {
  const hash = createHash("sha256").update(catalogImageDedupeKey(sourceUrl)).digest("hex").slice(0, 20)
  const file = `mirror-${hash}.${ext}`
  return kind === "variant" ? `board-models/dimensions/${file}` : `board-models/${file}`
}

export type MirrorBrandCatalogImageResult =
  | { ok: true; publicUrl: string; skipped: "already_mirrored" | "uploaded" }
  | { ok: false; error: string }

/**
 * Downloads a remote catalog image and stores it in the public `brand-assets` bucket.
 * Idempotent: the same source URL always maps to the same object path (upsert).
 */
export async function mirrorBrandCatalogImageToStorage(opts: {
  supabase: SupabaseClient
  supabaseUrl: string
  sourceUrl: string
  kind: BrandCatalogImageKind
}): Promise<MirrorBrandCatalogImageResult> {
  const sourceUrl = extractFirstHttpImageUrl(opts.sourceUrl)
  if (!sourceUrl) return { ok: false, error: "Empty or invalid source URL" }

  if (isBrandCatalogImageMirrored(sourceUrl)) {
    return { ok: true, publicUrl: sourceUrl, skipped: "already_mirrored" }
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: IMAGE_FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
    })
    if (!res.ok) {
      return { ok: false, error: `Fetch failed (${res.status})` }
    }

    const contentType = res.headers.get("content-type")
    const rawBytes = Buffer.from(await res.arrayBuffer())
    if (rawBytes.byteLength < MIN_IMAGE_BYTES) {
      return { ok: false, error: "Downloaded image too small" }
    }

    const normalized = await normalizeImageBytes(rawBytes, contentType)
    const ext =
      normalized.ext ||
      extensionFromContentType(contentType) ||
      extensionFromUrl(sourceUrl) ||
      "jpg"

    const pathInBucket = storagePathForMirroredImage(sourceUrl, opts.kind, ext)

    const { error } = await opts.supabase.storage.from(BRAND_ASSETS_BUCKET).upload(pathInBucket, normalized.body, {
      upsert: true,
      contentType: normalized.mime,
      cacheControl: "31536000",
    })
    if (error) {
      return { ok: false, error: error.message }
    }

    return {
      ok: true,
      publicUrl: brandAssetsObjectPublicUrl(opts.supabaseUrl, pathInBucket),
      skipped: "uploaded",
    }
  } catch (err) {
    if (isAbortError(err)) return { ok: false, error: "Fetch aborted" }
    const message = err instanceof Error ? err.message : "Mirror failed"
    return { ok: false, error: message }
  }
}

/** In-memory dedupe for bulk imports — concurrent callers share one mirror per source URL. */
export function createBrandCatalogImageMirrorCache(): {
  mirror: (opts: {
    supabase: SupabaseClient
    supabaseUrl: string
    sourceUrl: string
    kind: BrandCatalogImageKind
  }) => Promise<MirrorBrandCatalogImageResult>
} {
  const cache = new Map<string, Promise<MirrorBrandCatalogImageResult>>()

  return {
    async mirror(opts) {
      const key = `${opts.kind}:${catalogImageDedupeKey(opts.sourceUrl)}`
      const existing = cache.get(key)
      if (existing) return existing

      const pending = mirrorBrandCatalogImageToStorage(opts)
      cache.set(key, pending)
      return pending
    },
  }
}
