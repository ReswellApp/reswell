import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"

export const FLORENCE_MARINE_X_BRAND_SLUG = "florence-marine-x"
export const FLORENCE_MARINE_X_BRAND_NAME = "Florence Marine X"
export const FLORENCE_MARINE_X_WEBSITE_URL = "https://www.florencemarinex.com"

export const DEFAULT_FLORENCE_MARINE_X_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260811_204006.json",
)

export type FlorenceMarineXJsonRow = {
  productName: string
  productImage: string
  productDescription: string
  productUrl: string
}

export function toFlorenceMarineXJsonRow(raw: Record<string, string>): FlorenceMarineXJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
  }
}

function splitImageUrls(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  return t
    .split(/\n+/)
    .flatMap((line) => line.split(/\s+/))
    .map((part) => part.replace(/[)\]},.]+$/, ""))
    .filter((u) => isValidHttpImageSource(u))
}

/** Use the first scraped product image for the model hero. */
export function resolveFlorenceMarineXModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function isValidFlorenceMarineXJsonRow(row: FlorenceMarineXJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadFlorenceMarineXJsonRows(jsonPath: string): FlorenceMarineXJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toFlorenceMarineXJsonRow).filter(isValidFlorenceMarineXJsonRow)
}
