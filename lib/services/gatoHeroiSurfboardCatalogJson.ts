import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"

export const GATO_HEROI_BRAND_SLUG = "gato-heroi"

export const DEFAULT_GATO_HEROI_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260704_202413.json",
)

export type GatoHeroiJsonRow = {
  productName: string
  productImage: string
}

export function toGatoHeroiJsonRow(raw: Record<string, string>): GatoHeroiJsonRow {
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
export function resolveGatoHeroiModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function isValidGatoHeroiJsonRow(row: GatoHeroiJsonRow): boolean {
  return row.productName.trim().length > 0
}

/** Keep the first row per product name — scrape often repeats the same board with different colorways. */
export function dedupeGatoHeroiJsonRows(rows: GatoHeroiJsonRow[]): GatoHeroiJsonRow[] {
  const seen = new Set<string>()
  const out: GatoHeroiJsonRow[] = []
  for (const row of rows) {
    const key = row.productName.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function loadGatoHeroiJsonRows(jsonPath: string): GatoHeroiJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return dedupeGatoHeroiJsonRows(
    parsed.map(toGatoHeroiJsonRow).filter(isValidGatoHeroiJsonRow),
  )
}
