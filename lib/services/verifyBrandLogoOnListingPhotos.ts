import Anthropic, { APIError } from "@anthropic-ai/sdk"

const MAX_IMAGE_BYTES = 1_500_000
const MIN_VERIFY_CONFIDENCE = 0.7
const FETCH_HEADERS = {
  "User-Agent": "ReswellSellBrandLogoVerify/1.0",
  Accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
} as const

type VisionImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
  base64: string
}

function mediaTypeFromContentType(ctRaw: string | null): VisionImage["mediaType"] {
  const ct = (ctRaw ?? "").split(";")[0]?.trim().toLowerCase()
  if (ct === "image/png" || ct === "image/webp" || ct === "image/gif" || ct === "image/jpeg") {
    return ct
  }
  if (ct === "image/jpg") return "image/jpeg"
  return "image/jpeg"
}

async function fetchImageAsBase64(url: string): Promise<VisionImage | null> {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  } catch {
    return null
  }

  try {
    const res = await fetch(trimmed, { headers: FETCH_HEADERS, cache: "no-store" })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null
    return {
      mediaType: mediaTypeFromContentType(res.headers.get("content-type")),
      base64: buf.toString("base64"),
    }
  } catch {
    return null
  }
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

export type BrandLogoVerifyResult =
  | { ok: true; match: boolean; confidence: number }
  | { ok: false; error: string }

/**
 * Second-pass vision check: does this directory brand logo/wordmark appear on the listing photos?
 * Pass already-fetched listing thumbs when available to avoid re-downloading.
 */
export async function verifyBrandLogoOnListingPhotos(input: {
  apiKey: string
  brandName: string
  logoUrl: string
  listingImages: VisionImage[]
  listingImageUrls?: string[]
}): Promise<BrandLogoVerifyResult> {
  const logo = await fetchImageAsBase64(input.logoUrl)
  if (!logo) {
    return { ok: false, error: "Couldn’t load brand logo." }
  }

  let listingImages = input.listingImages.slice(0, 3)
  if (listingImages.length === 0 && input.listingImageUrls?.length) {
    for (const url of input.listingImageUrls.slice(0, 3)) {
      const img = await fetchImageAsBase64(url)
      if (img) listingImages.push(img)
    }
  }
  if (listingImages.length === 0) {
    return { ok: false, error: "No listing photos for logo verify." }
  }

  const client = new Anthropic({ apiKey: input.apiKey })
  const started = Date.now()

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Image 1 is the official logo for the surfboard brand "${input.brandName}". The remaining images are seller listing photos of a surfboard.

Does the brand logo or a clear matching wordmark from Image 1 appear on any of the listing photos (deck, rail, tail pad, sticker, etc.)?

Respond with ONLY JSON:
{"match":boolean,"confidence":number}

confidence is 0–1. Set match=true only when the logo/wordmark is clearly visible — not because the board shape looks similar.`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: logo.mediaType,
                data: logo.base64,
              },
            },
            ...listingImages.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mediaType,
                data: img.base64,
              },
            })),
          ],
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === "text")
    const text = textBlock && textBlock.type === "text" ? textBlock.text : ""
    if (!text.trim()) {
      console.info("[verify-brand-logo] empty model text", {
        latencyMs: Date.now() - started,
        brandName: input.brandName,
      })
      return { ok: false, error: "Empty logo verify response." }
    }

    let parsed: unknown
    try {
      parsed = extractJsonObject(text)
    } catch {
      return { ok: false, error: "Invalid logo verify JSON." }
    }

    const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
    if (!obj) return { ok: false, error: "Invalid logo verify payload." }

    const match = obj.match === true
    let confidence =
      typeof obj.confidence === "number"
        ? obj.confidence
        : typeof obj.confidence === "string"
          ? Number(obj.confidence)
          : 0
    if (!Number.isFinite(confidence)) confidence = 0
    if (confidence > 1 && confidence <= 100) confidence = confidence / 100
    confidence = Math.max(0, Math.min(1, confidence))

    console.info("[verify-brand-logo] ok", {
      latencyMs: Date.now() - started,
      brandName: input.brandName,
      match,
      confidence,
    })

    return { ok: true, match, confidence }
  } catch (err) {
    console.info("[verify-brand-logo] anthropic error", {
      latencyMs: Date.now() - started,
      brandName: input.brandName,
      status: err instanceof APIError ? err.status : undefined,
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Logo verify failed.",
    }
  }
}

export { MIN_VERIFY_CONFIDENCE }
