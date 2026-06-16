import type { FbMarketplaceImportPreview } from "@/lib/validations/fb-marketplace-import"
import { sellFormConditionValue } from "@/lib/listing-labels"

const BROWSER_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "no-cache",
} as const

function htmlLooksLikeLoginWall(html: string): boolean {
  if (readMetaProperty(html, "og:title")) return false
  return (
    /log into facebook/i.test(html) ||
    /login_form/i.test(html) ||
    /"login":/i.test(html)
  )
}

function htmlHasListingSignals(html: string): boolean {
  return Boolean(
    readMetaProperty(html, "og:title") ||
      html.includes("marketplace_listing_title") ||
      html.includes("formatted_amount") ||
      html.includes("MarketplaceProductItem") ||
      html.includes("GroupCommerceProductItem"),
  )
}

async function fetchMarketplaceListingHtml(listingId: string): Promise<string> {
  const urls = [
    `https://www.facebook.com/marketplace/item/${listingId}/`,
    `https://m.facebook.com/marketplace/item/${listingId}/`,
  ]

  let lastStatus = 0
  let sawLoginWall = false

  for (const url of urls) {
    const res = await fetch(url, {
      headers: BROWSER_FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
    })
    lastStatus = res.status
    if (!res.ok) continue

    const html = await res.text()
    if (htmlLooksLikeLoginWall(html)) {
      sawLoginWall = true
      continue
    }
    if (htmlHasListingSignals(html)) return html

    // Some listings still embed data without og: tags — keep the largest usable HTML doc.
    if (html.length > 20_000) return html
  }

  if (sawLoginWall) {
    throw new Error(
      "Facebook requires a login to view that listing, so we can't import it automatically. Try a public listing link, or fill the form manually.",
    )
  }

  if (lastStatus === 404) {
    throw new Error("That Marketplace listing was not found. It may have been deleted or sold.")
  }

  if (lastStatus >= 400) {
    throw new Error(
      "Facebook blocked our request for that listing. Double-check the link, or fill the form manually.",
    )
  }

  throw new Error(
    "We couldn't read details from that Facebook listing. It may be private, deleted, or unavailable in your region.",
  )
}

function listingPreviewHasSignal(preview: {
  title: string
  description: string
  price: number | null
  imageUrls: string[]
}): boolean {
  const title = preview.title.trim()
  const hasTitle = title.length > 0 && title !== "Marketplace listing"
  return (
    hasTitle ||
    preview.description.trim().length > 0 ||
    preview.price != null ||
    preview.imageUrls.length > 0
  )
}

export function extractFbMarketplaceListingId(url: string): string | null {
  const match = url.match(/marketplace\/item\/(\d+)/i)
  return match?.[1] ?? null
}

function decodeMetaContent(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
    .trim()
}

function readMetaProperty(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeMetaContent(m[1])
  }
  return null
}

function readMetaName(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeMetaContent(m[1])
  }
  return null
}

function parsePriceFromText(text: string): number | null {
  const match = text.match(/\$\s?([\d,]+(?:\.\d{2})?)/)
  if (!match?.[1]) return null
  const n = Number.parseFloat(match[1].replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseDimensionsFromText(text: string): string | null {
  const patterns = [
    /\d+'?\d*["']?\s*[x×]\s*[\d.]+(?:\s*\d+\/\d+)?["']?\s*[x×]\s*[\d.]+(?:\s*\d+\/\d+)?["']?/i,
    /\d+'\s*\d+["']?\s*[x×]\s*[\d.]+["']?\s*[x×]\s*[\d.]+["']?/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[0]) return m[0].replace(/\s+/g, " ").trim()
  }
  return null
}

function mapFbCondition(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase()
  if (!v) return ""
  if (v.includes("brand new") || v === "new") return "brand_new"
  if (v.includes("like new")) return "excellent"
  if (v.includes("very good")) return "very_good"
  if (v.includes("good")) return "good"
  if (v.includes("fair")) return "fair"
  if (v.includes("poor")) return "poor"
  return sellFormConditionValue(v)
}

function cleanMarketplaceTitle(raw: string): string {
  return raw
    .replace(/\s*[|\-–—]\s*Facebook Marketplace.*$/i, "")
    .replace(/\s*[|\-–—]\s*Marketplace.*$/i, "")
    .trim()
}

function unescapeEmbeddedJsonString(raw: string): string {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\//g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .trim()
}

function extractJsonStringField(html: string, field: string): string | null {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`)
  const m = html.match(re)
  if (!m?.[1]) return null
  return unescapeEmbeddedJsonString(m[1])
}

/**
 * Facebook item pages embed "similar listings" JSON in the same HTML document.
 * Scope parsing to chunks tied to this listing id so we don't import a neighbor's truck.
 */
function extractScopedListingChunk(html: string, listingId: string): string {
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let best = ""

  for (let match = scriptRe.exec(html); match; match = scriptRe.exec(html)) {
    const content = match[1] ?? ""
    if (!content.includes(listingId)) continue
    if (
      content.includes("listing_photos") ||
      content.includes("marketplace_listing_title") ||
      content.includes("MarketplaceProductItem")
    ) {
      if (content.length > best.length) best = content
    }
  }

  if (best.length > 500) return best

  const photosIdx = html.indexOf('"listing_photos"')
  if (photosIdx !== -1) {
    const chunk = html.slice(Math.max(0, photosIdx - 8_000), photosIdx + 30_000)
    if (chunk.includes(listingId)) return chunk
  }

  const idIdx = html.indexOf(listingId)
  if (idIdx !== -1) {
    return html.slice(Math.max(0, idIdx - 4_000), idIdx + 16_000)
  }

  return html
}

function extractListingPhotoUrls(scope: string, ogImage: string | null): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  function push(url: string | null | undefined) {
    const normalized = (url ?? "").trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    urls.push(normalized)
  }

  push(ogImage)

  const photosIdx = scope.indexOf('"listing_photos"')
  if (photosIdx !== -1) {
    const photosSlice = scope.slice(photosIdx, photosIdx + 60_000)
    for (const match of photosSlice.matchAll(/"uri"\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
      const uri = unescapeEmbeddedJsonString(match[1] ?? "")
      if (!uri.includes("scontent") && !uri.includes("fbcdn")) continue
      push(uri)
    }
  }

  return urls.slice(0, 12)
}

function parseCityState(
  scope: string,
  description: string,
  ogDescription: string,
): { city: string; state: string } {
  const city =
    extractJsonStringField(scope, "city") ??
    extractJsonStringField(scope, "city_page_display_name") ??
    ""
  const state = extractJsonStringField(scope, "state") ?? ""

  if (city.trim() && state.trim()) {
    return { city: city.trim(), state: state.trim() }
  }

  for (const text of [description, ogDescription]) {
    const locationLine = text.match(/(?:Located in|Location:?)\s+([^.\n]+)/i)?.[1]
    if (locationLine) {
      const parts = locationLine.split(",").map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        return {
          city: parts.slice(0, -1).join(", "),
          state: parts[parts.length - 1] ?? "",
        }
      }
      if (parts.length === 1) return { city: parts[0] ?? "", state: "" }
    }
  }

  return { city: city.trim(), state: state.trim() }
}

const SURFBOARD_BRAND_HINTS = [
  "Channel Islands",
  "Lost",
  "Pyzel",
  "Firewire",
  "Hayden Shapes",
  "JS Industries",
  "Album",
  "Torq",
  "Softech",
] as const

function guessBrandFromTitle(title: string): string {
  const cleaned = title.trim()
  if (!cleaned) return ""

  for (const brand of SURFBOARD_BRAND_HINTS) {
    if (cleaned.toLowerCase().includes(brand.toLowerCase())) return brand
  }

  const first = cleaned.split(/\s+/)[0] ?? ""
  if (/^\d{4}$/.test(first)) return ""
  if (first.length >= 2 && first.length <= 24) return first
  return ""
}

function guessModelFromTitle(title: string, brand: string): string {
  let model = title.trim()
  if (brand) {
    const idx = model.toLowerCase().indexOf(brand.toLowerCase())
    if (idx !== -1) {
      model = model.slice(idx + brand.length).trim()
    }
  }
  model = model.replace(/\s*\d+'?\d*.*$/i, "").trim()
  return model.slice(0, 200)
}

export async function previewFbMarketplaceListing(url: string): Promise<FbMarketplaceImportPreview> {
  const listingId = extractFbMarketplaceListingId(url)
  if (!listingId) {
    throw new Error("Could not read a Marketplace listing ID from that URL.")
  }

  const canonicalUrl = `https://www.facebook.com/marketplace/item/${listingId}/`
  const html = await fetchMarketplaceListingHtml(listingId)
  const scope = extractScopedListingChunk(html, listingId)
  const warnings: string[] = []

  const ogTitle = readMetaProperty(html, "og:title")
  const ogDescription =
    readMetaProperty(html, "og:description") ?? readMetaName(html, "description") ?? ""
  const ogImage = readMetaProperty(html, "og:image")

  const jsonTitle =
    extractJsonStringField(scope, "marketplace_listing_title") ??
    extractJsonStringField(scope, "title")
  const jsonDescription =
    extractJsonStringField(scope, "description") ??
    extractJsonStringField(scope, "redacted_description")

  const title = cleanMarketplaceTitle(ogTitle ?? jsonTitle ?? "Marketplace listing")
  const description = (ogDescription || jsonDescription).trim()

  const formattedAmount = extractJsonStringField(scope, "formatted_amount")
  const price =
    parsePriceFromText(formattedAmount ?? "") ??
    parsePriceFromText(ogDescription) ??
    parsePriceFromText(ogTitle ?? "") ??
    parsePriceFromText(description)

  if (price == null) {
    warnings.push("We couldn't detect the price — enter it below.")
  }

  const condition = mapFbCondition(
    extractJsonStringField(scope, "condition") ??
      extractJsonStringField(scope, "item_condition"),
  )

  const dimensions =
    parseDimensionsFromText(ogDescription) ??
    parseDimensionsFromText(description) ??
    parseDimensionsFromText(title) ??
    ""
  const { city, state } = parseCityState(scope, description, ogDescription)
  if (!city || !state) {
    warnings.push("Add your city and state before publishing.")
  }

  const imageUrls = extractListingPhotoUrls(scope, ogImage)
  if (imageUrls.length === 0) {
    warnings.push("No photos were found — upload at least one before publishing.")
  }

  if (!description) {
    warnings.push("Description was empty — add details if you can.")
  }

  const brand = guessBrandFromTitle(title)
  const model = guessModelFromTitle(title, brand)

  const preview = {
    sourceUrl: canonicalUrl,
    listingId,
    title,
    price,
    description,
    brand,
    model,
    dimensions,
    condition,
    city,
    state,
    imageUrls,
    warnings,
  }

  if (!listingPreviewHasSignal(preview)) {
    throw new Error(
      "We couldn't read details from that Facebook listing. It may be private, deleted, or unavailable in your region.",
    )
  }

  return preview
}
