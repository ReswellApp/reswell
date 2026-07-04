import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"

export const AH_VESSELS_BRAND_SLUG = "a-h-vessels"

export const DEFAULT_AH_VESSELS_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260704_013011.json",
)

export type AhVesselsJsonRow = {
  productName: string
  productImage: string
}

export function toAhVesselsJsonRow(raw: Record<string, string>): AhVesselsJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
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
export function resolveAhVesselsModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function isValidAhVesselsJsonRow(row: AhVesselsJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadAhVesselsJsonRows(jsonPath: string): AhVesselsJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toAhVesselsJsonRow).filter(isValidAhVesselsJsonRow)
}
