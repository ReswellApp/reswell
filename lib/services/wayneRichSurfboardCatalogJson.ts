import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"

export const WAYNE_RICH_BRAND_SLUG = "wayne-rich-surfboards"

export const DEFAULT_WAYNE_RICH_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260704_012737.json",
)

export type WayneRichJsonRow = {
  productName: string
  productImage: string
}

export function toWayneRichJsonRow(raw: Record<string, string>): WayneRichJsonRow {
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
export function resolveWayneRichModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function isValidWayneRichJsonRow(row: WayneRichJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadWayneRichJsonRows(jsonPath: string): WayneRichJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toWayneRichJsonRow).filter(isValidWayneRichJsonRow)
}
