import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"

export const DEFAULT_FB_MARKETPLACE_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260712_180036.json",
)

export type FbMarketplaceThunderbitRow = {
  productName: string
  productUrl: string
  priceUsd: number | null
  location: string
  productImage: string
  condition: string
  description: string
}

function parsePriceUsd(raw: string | undefined): number | null {
  const t = raw?.trim().replace(/,/g, "") ?? ""
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function optionalText(raw: string | undefined): string | null {
  const t = raw?.trim() ?? ""
  return t.length ? t : null
}

export function toFbMarketplaceThunderbitRow(
  raw: Record<string, string>,
): FbMarketplaceThunderbitRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    priceUsd: parsePriceUsd(raw["Price (USD)"]),
    location: raw["Location"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    condition: raw["Condition"]?.trim() ?? "",
    description: raw["Description"]?.trim() ?? "",
  }
}

export function isValidFbMarketplaceThunderbitRow(row: FbMarketplaceThunderbitRow): boolean {
  return row.productName.length > 0
}

const FB_MARKETPLACE_ITEM_URL_RE =
  /https:\/\/www\.facebook\.com\/marketplace\/item\/\d+\/[^,\s\n]*/gi

const EMBEDDED_LISTING_RE =
  /([^,\n]+?),https:\/\/www\.facebook\.com\/marketplace\/item\/(\d+)[^,\n]*?,(\d+),([^,\n]+)/g

function isValidHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function extractFbImageUrls(text: string): string[] {
  const matches = text.match(/https:\/\/scontent[^"'\s\]]+/g) ?? []
  return [...new Set(matches)]
}

/** Recover rows when Thunderbit merges multiple listings into one malformed object. */
function recoverEmbeddedThunderbitRows(raw: Record<string, string>): FbMarketplaceThunderbitRow[] {
  const combined = Object.values(raw).join("\n")
  const images = extractFbImageUrls(combined)
  const recovered: FbMarketplaceThunderbitRow[] = []

  for (const match of combined.matchAll(EMBEDDED_LISTING_RE)) {
    const [, name, itemId, price, location] = match
    const urlMatch = combined.match(
      new RegExp(
        `https://www\\.facebook\\.com/marketplace/item/${itemId}/[^,\\s\\n]*`,
        "i",
      ),
    )
    recovered.push({
      productName: name?.trim() ?? "",
      productUrl: urlMatch?.[0]?.trim() ?? "",
      priceUsd: parsePriceUsd(price),
      location: location?.trim() ?? "",
      productImage: images[recovered.length] ?? "",
      condition: "",
      description: "",
    })
  }

  return recovered.filter(isValidFbMarketplaceThunderbitRow)
}

export function toFbMarketplaceCatalogInsert(row: FbMarketplaceThunderbitRow) {
  return {
    name: row.productName,
    price: row.priceUsd,
    location: optionalText(row.location),
    image_url: optionalText(row.productImage),
    condition: optionalText(row.condition),
    description: optionalText(row.description),
    source_url: optionalText(row.productUrl),
  }
}

export function loadFbMarketplaceThunderbitRows(jsonPath: string): FbMarketplaceThunderbitRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }

  const rows: FbMarketplaceThunderbitRow[] = []
  for (const item of parsed) {
    const row = toFbMarketplaceThunderbitRow(item)
    if (isValidFbMarketplaceThunderbitRow(row) && isValidHttpUrl(row.productUrl)) {
      rows.push(row)
      continue
    }

    const recovered = recoverEmbeddedThunderbitRows(item).filter((r) => isValidHttpUrl(r.productUrl))
    if (recovered.length) {
      rows.push(...recovered)
    }
  }

  return rows
}
