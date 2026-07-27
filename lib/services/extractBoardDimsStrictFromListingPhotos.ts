import Anthropic from "@anthropic-ai/sdk"
import sharp from "sharp"
import {
  listingFullImageUrlFromRef,
  listingStorageObjectPathFromUrl,
} from "@/lib/listing-media-proxy-url"
import { normalizeScanBoardDimsModelOutput } from "@/lib/services/scanBoardDimensions"
import {
  scanBoardDimsModelOutputSchema,
  type ScanBoardDimsNormalized,
} from "@/lib/validations/scan-board-dims"

const MAX_DOWNLOAD_BYTES = 8_000_000
const MAX_LONG_EDGE = 2048
const FETCH_HEADERS = {
  "User-Agent": "ReswellSellDimsStrict/1.0",
  Accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
} as const

const STRICT_DIMS_PROMPT = `You read surfboard dimension stickers in listing photos (often handwritten on foam or a black label).

Step 1: Transcribe the dimension line into rawText EXACTLY as written (keep fractions with /, keep decimals as decimals, keep ' for feet). Example: 6'4" 19 3/8" 2 5/8" 38.4L

Step 2: Parse fields FROM that rawText only — do not invent or "correct" fractions.
- length: feet'inches e.g. "6'4"
- widthInches: second measurement e.g. "19 3/8" or "18.25" — EXACTLY as in rawText
- thicknessInches: third measurement e.g. "2 5/8" — EXACTLY as in rawText  
- volumeL: liters number without L e.g. "38.4"

Common mistake to avoid: do not swap 3/8 with 1/2 or 1/4. Read each digit of the fraction carefully.

If a field is not clearly readable, null that field. Never guess.
confidence 0–1 per field. Prefer lower confidence over a wrong fraction.

Respond with ONLY JSON:
{"rawText":string,"length":string|null,"widthInches":string|null,"thicknessInches":string|null,"volumeL":string|null,"confidence":{"length":number,"widthInches":number,"thicknessInches":number,"volumeL":number}}`

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fence ? fence[1] : trimmed).trim()
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Model did not return JSON")
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

async function fetchAndDownscaleForDims(url: string): Promise<{
  mediaType: "image/jpeg"
  base64: string
} | null> {
  const full = listingFullImageUrlFromRef(url) ?? url
  if (!listingStorageObjectPathFromUrl(full) && !listingStorageObjectPathFromUrl(url)) {
    return null
  }
  const fetchUrl = listingStorageObjectPathFromUrl(full) ? full : url

  try {
    const res = await fetch(fetchUrl, { headers: FETCH_HEADERS, cache: "no-store" })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_DOWNLOAD_BYTES) return null

    const jpeg = await sharp(buf)
      .rotate()
      .resize({
        width: MAX_LONG_EDGE,
        height: MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer()

    return { mediaType: "image/jpeg", base64: jpeg.toString("base64") }
  } catch {
    return null
  }
}

/**
 * Dims-only vision pass on up to 2 full-res listing photos (thumb URLs upgraded to -full.).
 * Accuracy over coverage — returns null fields when the sticker is unclear.
 */
/** Prefer mid-set photos — dims stickers are rarely the cover beauty shot. */
function prioritizeStickerCandidateUrls(urls: string[]): string[] {
  if (urls.length <= 2) return urls
  const mid = (urls.length - 1) / 2
  return [...urls]
    .map((url, i) => ({ url, dist: Math.abs(i - mid) }))
    .sort((a, b) => a.dist - b.dist)
    .map((row) => row.url)
}

export async function extractBoardDimsStrictFromListingPhotos(input: {
  apiKey: string
  imageUrls: string[]
}): Promise<ScanBoardDimsNormalized | null> {
  const unique = prioritizeStickerCandidateUrls([
    ...new Set(input.imageUrls.map((u) => u.trim()).filter(Boolean)),
  ])
  const images: { mediaType: "image/jpeg"; base64: string }[] = []

  for (const url of unique) {
    if (images.length >= 2) break
    const img = await fetchAndDownscaleForDims(url)
    if (img) images.push(img)
  }

  if (images.length === 0) return null

  const client = new Anthropic({ apiKey: input.apiKey })
  const started = Date.now()

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mediaType,
                data: img.base64,
              },
            })),
            { type: "text" as const, text: STRICT_DIMS_PROMPT },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    const text = textBlock && textBlock.type === "text" ? textBlock.text : ""
    if (!text.trim()) {
      console.info("[extract-dims-strict] empty model text", {
        latencyMs: Date.now() - started,
      })
      return null
    }

    let parsedUnknown: unknown
    try {
      parsedUnknown = extractJsonObject(text)
    } catch {
      console.info("[extract-dims-strict] json parse failed", {
        latencyMs: Date.now() - started,
      })
      return null
    }

    const modelParsed = scanBoardDimsModelOutputSchema.safeParse(parsedUnknown)
    if (!modelParsed.success) {
      console.info("[extract-dims-strict] schema failed", {
        latencyMs: Date.now() - started,
      })
      return null
    }

    const normalized = normalizeScanBoardDimsModelOutput(modelParsed.data)
    console.info("[extract-dims-strict] ok", {
      latencyMs: Date.now() - started,
      fieldCount: normalized.fieldCount,
      rawText: normalized.rawText,
      width: normalized.boardWidthInches,
      thickness: normalized.boardThicknessInches,
    })

    return normalized.fieldCount > 0 ? normalized : null
  } catch (err) {
    console.info("[extract-dims-strict] error", {
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "unknown",
    })
    return null
  }
}
