import Anthropic, { APIError, AuthenticationError } from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  type FacetOption,
} from "@/lib/boards-browse-facets"
import {
  listSurfboardBrandsForPhotoExtract,
  type BrandExtractCatalogRow,
} from "@/lib/db/brands-extract-catalog"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-proxy-url"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import { extractBoardDimsStrictFromListingPhotos } from "@/lib/services/extractBoardDimsStrictFromListingPhotos"
import { normalizeScanBoardDimsModelOutput } from "@/lib/services/scanBoardDimensions"
import {
  MIN_VERIFY_CONFIDENCE,
  verifyBrandLogoOnListingPhotos,
} from "@/lib/services/verifyBrandLogoOnListingPhotos"
import { slugify } from "@/lib/slugify"
import {
  EXTRACT_LISTING_MAX_IMAGE_URLS,
  extractListingFromPhotosModelOutputSchema,
  type ExtractListingFromPhotosModelOutput,
  type ExtractListingFromPhotosNormalized,
  type ExtractMatchedBrand,
} from "@/lib/validations/extract-listing-from-photos"

const MIN_FIELD_CONFIDENCE = 0.45
const MIN_BRAND_TEXT_ONLY_CONFIDENCE = 0.85
const MAX_IMAGE_BYTES = 1_500_000
const FETCH_HEADERS = {
  "User-Agent": "ReswellSellPhotoExtract/1.0",
  Accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
} as const

const ANTHROPIC_KEY_REJECTED =
  "Anthropic rejected your API key (invalid x-api-key). In .env.local use ANTHROPIC_API_KEY=sk-ant-... on a single line with no quotes or spaces."

function normalizeAnthropicApiKey(raw: string): string {
  let k = raw.trim()
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim()
  }
  return k
}

function userFacingAnthropicError(err: unknown): string {
  if (err instanceof AuthenticationError) return ANTHROPIC_KEY_REJECTED
  if (err instanceof APIError && err.status === 401) return ANTHROPIC_KEY_REJECTED
  if (err instanceof APIError) {
    return err.message.length < 280
      ? err.message
      : "Couldn’t analyze your photos right now."
  }
  return err instanceof Error ? err.message : "Couldn’t analyze your photos right now."
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fence ? fence[1] : trimmed).trim()
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) {
    throw new Error("Model did not return JSON")
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

function confidenceOk(
  confidence: ExtractListingFromPhotosModelOutput["confidence"],
  key: keyof NonNullable<ExtractListingFromPhotosModelOutput["confidence"]>,
  min = MIN_FIELD_CONFIDENCE,
): boolean {
  const value = confidence?.[key]
  if (value == null) return true
  return value >= min
}

function allowFacetSlug(
  raw: string | null | undefined,
  options: readonly FacetOption[],
): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim().toLowerCase().replace(/[\s/-]+/g, "_")
  const byValue = options.find((o) => o.value === t || o.value === raw.trim().toLowerCase())
  if (byValue) return byValue.value
  const byLabel = options.find((o) => {
    const label = o.label.toLowerCase()
    const compact = label.replace(/[\s/-]+/g, "_")
    const rawLower = raw.trim().toLowerCase()
    return rawLower === label || t === compact || rawLower === o.value.replace(/_/g, " ")
  })
  return byLabel?.value ?? null
}

/** True when URL points at our listings storage bucket (public object). */
export function isAllowedListingPhotoExtractUrl(url: string): boolean {
  return listingStorageObjectPathFromUrl(url) != null
}

type FetchedImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
  base64: string
}

async function fetchListingThumbAsBase64(url: string): Promise<FetchedImage | null> {
  if (!isAllowedListingPhotoExtractUrl(url)) return null
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null
    const ct = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase()
    let mediaType: FetchedImage["mediaType"] = "image/jpeg"
    if (ct === "image/png" || ct === "image/webp" || ct === "image/gif" || ct === "image/jpeg") {
      mediaType = ct
    } else if (ct === "image/jpg") {
      mediaType = "image/jpeg"
    }
    return { mediaType, base64: buf.toString("base64") }
  } catch {
    return null
  }
}

function normalizeBrandToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function findCatalogBrandByHint(
  hint: string,
  catalog: readonly BrandExtractCatalogRow[],
): BrandExtractCatalogRow | null {
  const token = normalizeBrandToken(hint)
  if (!token) return null
  const hintSlug = slugify(hint)

  const exact = catalog.find(
    (b) =>
      normalizeBrandToken(b.name) === token ||
      b.slug.toLowerCase() === hintSlug ||
      b.slug.toLowerCase() === token.replace(/\s+/g, "-"),
  )
  if (exact) return exact

  // Allow short aliases like "CI" only when they uniquely match a slug token.
  if (token.length <= 3) {
    const slugHits = catalog.filter(
      (b) =>
        b.slug.toLowerCase() === token ||
        b.slug.toLowerCase().startsWith(`${token}-`) ||
        normalizeBrandToken(b.name)
          .split(" ")
          .some((part) => part === token),
    )
    return slugHits.length === 1 ? slugHits[0]! : null
  }

  return null
}

function isNearExactBrandMatch(
  hint: string,
  brand: { name: string; slug: string },
): boolean {
  const hintToken = normalizeBrandToken(hint)
  const nameToken = normalizeBrandToken(brand.name)
  const hintSlug = slugify(hint)
  const brandSlug = brand.slug.toLowerCase()
  if (!hintToken || !nameToken) return false
  if (hintToken === nameToken) return true
  if (hintSlug === brandSlug) return true
  // "Channel Islands Surfboards" vs "Channel Islands"
  if (nameToken.startsWith(hintToken) || hintToken.startsWith(nameToken)) {
    const shorter = hintToken.length <= nameToken.length ? hintToken : nameToken
    return shorter.length >= 6
  }
  return false
}

/**
 * Map model JSON through Reswell dim parsers + facet allow-lists.
 * brandHint is kept when present; matchedBrand is attached later after resolve/verify.
 */
export function normalizeExtractListingFromPhotosModelOutput(
  raw: ExtractListingFromPhotosModelOutput,
  options?: { brandHint?: string | null },
): ExtractListingFromPhotosNormalized {
  const dims = normalizeScanBoardDimsModelOutput({
    length: raw.length,
    widthInches: raw.widthInches,
    thicknessInches: raw.thicknessInches,
    volumeL: raw.volumeL,
    confidence: {
      length: raw.confidence?.length,
      widthInches: raw.confidence?.widthInches,
      thicknessInches: raw.confidence?.thicknessInches,
      volumeL: raw.confidence?.volumeL,
    },
    rawText: raw.rawText,
  })

  const boardFins = confidenceOk(raw.confidence, "finSetup")
    ? allowFacetSlug(raw.finSetup, FIN_SETUP_OPTIONS)
    : null
  const boardFinSystem = confidenceOk(raw.confidence, "finSystem")
    ? allowFacetSlug(raw.finSystem, FIN_SYSTEM_OPTIONS)
    : null
  const boardConstruction = confidenceOk(raw.confidence, "construction")
    ? allowFacetSlug(raw.construction, CONSTRUCTION_OPTIONS)
    : null

  const brandHint =
    options?.brandHint !== undefined
      ? options.brandHint
      : raw.brandHint?.trim() || null

  const fieldCount = [
    dims.boardLength,
    dims.boardWidthInches,
    dims.boardThicknessInches,
    dims.boardVolumeL,
    boardFins,
    boardFinSystem,
    boardConstruction,
  ].filter((v) => v != null && v !== "").length

  return {
    boardLength: dims.boardLength,
    boardWidthInches: dims.boardWidthInches,
    boardThicknessInches: dims.boardThicknessInches,
    boardVolumeL: dims.boardVolumeL,
    boardFins,
    boardFinSystem,
    boardConstruction,
    fieldCount,
    brandHint,
    matchedBrand: null,
    modelHint: null,
  }
}

export type ExtractListingFromPhotosResult =
  | { ok: true; data: ExtractListingFromPhotosNormalized }
  | { ok: false; error: string; status: number }

function buildExtractPrompt(catalog: readonly BrandExtractCatalogRow[]): string {
  const finSetup = FIN_SETUP_OPTIONS.map((o) => o.value).join(", ")
  const finSystem = FIN_SYSTEM_OPTIONS.map((o) => o.value).join(", ")
  const construction = CONSTRUCTION_OPTIONS.map((o) => o.value).join(", ")
  const brandNames = catalog.map((b) => b.name).join(" | ")

  return `You analyze surfboard listing photos for a marketplace sell form.

Look across ALL provided images (deck, bottom, nose, tail, close-ups, stickers, logos).

Extract when clearly visible:
- length: feet and inches, e.g. "5'9" or "6'2"
- widthInches / thicknessInches: copy sticker notation EXACTLY.
  - Fractions on the board → fraction strings with "/" (e.g. "19 3/8"). NEVER convert to decimals.
  - Decimals on the board → decimal strings (e.g. "18.25"). NEVER convert to fractions.
- volumeL: liters number string without L, e.g. "28.4"
- rawText: short transcription of any dimension line exactly as written (keep / for fractions)
- finSetup: ONE slug from [${finSetup}] only (from bottom/tail layout)
- finSystem: ONE slug from [${finSystem}] only (Futures/FCS logos, glass-on, etc.)
- construction: ONE slug from [${construction}] only (EPS/EPOXY sticker → eps_epoxy, PU/poly → pu_poly, carbon → carbon)
- brandHint: ONE brand name from the catalog below when a logo or wordmark is clearly visible on the board. Prefer logos/wordmarks over guessing from board shape. If unclear or not in the catalog, null.
- modelHint: always null in this pass

Brand catalog (use exact name spelling when matching):
${brandNames || "(empty)"}

Prefer sticker text for dimensions and construction when present.
Infer fins only from clear evidence.
Use only the slug lists above for finSetup/finSystem/construction.
Do not invent a brand that is not in the catalog.

Respond with ONLY JSON (no markdown):
{"length":string|null,"widthInches":string|null,"thicknessInches":string|null,"volumeL":string|null,"finSetup":string|null,"finSystem":string|null,"construction":string|null,"brandHint":string|null,"modelHint":null,"confidence":{"length":number,"widthInches":number,"thicknessInches":number,"volumeL":number,"finSetup":number,"finSystem":number,"construction":number,"brand":number},"rawText":string}`
}

async function resolveMatchedBrand(input: {
  supabase: SupabaseClient
  apiKey: string
  brandHint: string | null
  brandConfidence: number | undefined
  catalog: readonly BrandExtractCatalogRow[]
  listingImages: FetchedImage[]
}): Promise<ExtractMatchedBrand | null> {
  const hint = input.brandHint?.trim()
  if (!hint) return null

  if (!confidenceOk({ brand: input.brandConfidence }, "brand", MIN_FIELD_CONFIDENCE)) {
    return null
  }

  const fromCatalog = findCatalogBrandByHint(hint, input.catalog)
  const resolved =
    fromCatalog != null
      ? {
          id: fromCatalog.id,
          name: fromCatalog.name,
          slug: fromCatalog.slug,
          logo_url: fromCatalog.logo_url,
        }
      : await resolveDirectoryBrandRowFromLabel(input.supabase, hint)

  if (!resolved) return null

  // Prefer catalog logo when resolve came from directory search without joining logo.
  const catalogRow =
    fromCatalog ??
    input.catalog.find((b) => b.id === resolved.id) ??
    null
  const logoUrl = catalogRow?.logo_url?.trim() || resolved.logo_url?.trim() || null

  if (logoUrl) {
    const verify = await verifyBrandLogoOnListingPhotos({
      apiKey: input.apiKey,
      brandName: resolved.name,
      logoUrl,
      listingImages: input.listingImages,
    })
    if (!verify.ok || !verify.match || verify.confidence < MIN_VERIFY_CONFIDENCE) {
      console.info("[extract-listing-from-photos] brand logo verify rejected", {
        brandId: resolved.id,
        brandName: resolved.name,
        ok: verify.ok,
        match: verify.ok ? verify.match : false,
        confidence: verify.ok ? verify.confidence : null,
      })
      return null
    }
    return { id: resolved.id, name: resolved.name, slug: resolved.slug }
  }

  // No logo — require strong text confidence + near-exact name/slug match.
  const textConfidence = input.brandConfidence ?? 0
  if (textConfidence < MIN_BRAND_TEXT_ONLY_CONFIDENCE) return null
  if (!isNearExactBrandMatch(hint, resolved)) return null
  return { id: resolved.id, name: resolved.name, slug: resolved.slug }
}

export async function extractListingFromPhotos(input: {
  imageUrls: string[]
  supabase: SupabaseClient
}): Promise<ExtractListingFromPhotosResult> {
  const apiKey = normalizeAnthropicApiKey(process.env.ANTHROPIC_API_KEY ?? "")
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "Photo analysis is not configured.",
    }
  }

  const uniqueUrls = [...new Set(input.imageUrls.map((u) => u.trim()).filter(Boolean))].slice(
    0,
    EXTRACT_LISTING_MAX_IMAGE_URLS,
  )
  const fetched: FetchedImage[] = []
  for (const url of uniqueUrls) {
    const img = await fetchListingThumbAsBase64(url)
    if (img) fetched.push(img)
  }

  if (fetched.length === 0) {
    return {
      ok: false,
      status: 422,
      error: "Couldn’t load listing photos for analysis.",
    }
  }

  const catalog = await listSurfboardBrandsForPhotoExtract(input.supabase)
  const client = new Anthropic({ apiKey })
  const started = Date.now()

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            ...fetched.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mediaType,
                data: img.base64,
              },
            })),
            { type: "text" as const, text: buildExtractPrompt(catalog) },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    const text = textBlock && textBlock.type === "text" ? textBlock.text : ""
    if (!text.trim()) {
      console.info("[extract-listing-from-photos] empty model text", {
        latencyMs: Date.now() - started,
        imageCount: fetched.length,
      })
      return { ok: false, status: 422, error: "No details found in these photos." }
    }

    let parsedUnknown: unknown
    try {
      parsedUnknown = extractJsonObject(text)
    } catch {
      console.info("[extract-listing-from-photos] json parse failed", {
        latencyMs: Date.now() - started,
      })
      return { ok: false, status: 422, error: "No details found in these photos." }
    }

    const modelParsed = extractListingFromPhotosModelOutputSchema.safeParse(parsedUnknown)
    if (!modelParsed.success) {
      console.info("[extract-listing-from-photos] schema failed", {
        latencyMs: Date.now() - started,
        issues: modelParsed.error.issues.slice(0, 8).map((i) => ({
          path: i.path.join("."),
          code: i.code,
          message: i.message,
        })),
        keys:
          parsedUnknown && typeof parsedUnknown === "object"
            ? Object.keys(parsedUnknown as Record<string, unknown>)
            : [],
      })
      return { ok: false, status: 422, error: "No details found in these photos." }
    }

    const rawHint = modelParsed.data.brandHint?.trim() || null
    const catalogHint = rawHint ? findCatalogBrandByHint(rawHint, catalog) : null
    // Keep hint only when it maps to catalog (or leave raw for resolve fallback when non-empty catalog miss).
    const brandHintForNormalize = rawHint

    let normalized = normalizeExtractListingFromPhotosModelOutput(modelParsed.data, {
      brandHint: brandHintForNormalize,
    })

    // Accuracy pass: full-res dims-only read. Prefer this over the multi-task thumb pass.
    const strictDims = await extractBoardDimsStrictFromListingPhotos({
      apiKey,
      imageUrls: uniqueUrls,
    })
    if (strictDims) {
      const prevDimCount = [
        normalized.boardLength,
        normalized.boardWidthInches,
        normalized.boardThicknessInches,
        normalized.boardVolumeL,
      ].filter((v) => v != null && v !== "").length
      normalized = {
        ...normalized,
        boardLength: strictDims.boardLength,
        boardWidthInches: strictDims.boardWidthInches,
        boardThicknessInches: strictDims.boardThicknessInches,
        boardVolumeL: strictDims.boardVolumeL,
        fieldCount: normalized.fieldCount - prevDimCount + strictDims.fieldCount,
      }
    }

    const matchedBrand = await resolveMatchedBrand({
      supabase: input.supabase,
      apiKey,
      brandHint: catalogHint?.name ?? brandHintForNormalize,
      brandConfidence: modelParsed.data.confidence?.brand,
      catalog,
      listingImages: fetched,
    })

    if (matchedBrand) {
      normalized = {
        ...normalized,
        matchedBrand,
        fieldCount: normalized.fieldCount + 1,
      }
    }

    console.info("[extract-listing-from-photos] ok", {
      latencyMs: Date.now() - started,
      fieldCount: normalized.fieldCount,
      imageCount: fetched.length,
      brandHint: normalized.brandHint,
      matchedBrandId: matchedBrand?.id ?? null,
      catalogSize: catalog.length,
      width: normalized.boardWidthInches,
      thickness: normalized.boardThicknessInches,
      strictDims: Boolean(strictDims),
    })

    if (normalized.fieldCount === 0) {
      return { ok: false, status: 422, error: "No details found in these photos." }
    }

    return { ok: true, data: normalized }
  } catch (err) {
    console.info("[extract-listing-from-photos] anthropic error", {
      latencyMs: Date.now() - started,
    })
    const status = err instanceof APIError ? err.status : 502
    return {
      ok: false,
      status: status === 401 ? 503 : 502,
      error: userFacingAnthropicError(err),
    }
  }
}
