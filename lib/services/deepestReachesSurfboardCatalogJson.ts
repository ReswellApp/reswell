import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"

export const DEEPEST_REACHES_BRAND_SLUG = "deepest-reaches-surfboards"

export const DEFAULT_DEEPEST_REACHES_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260723_022538.json",
)

/** Scrape names that differ from catalog display names. */
const DEEPEST_REACHES_MODEL_NAME_ALIASES: Record<string, string> = {
  megafish: "Mega Fish",
}

export type DeepestReachesJsonRow = {
  productName: string
  productImage: string
  sizeRange: string
  features: string
  description: string
}

export function toDeepestReachesJsonRow(raw: Record<string, string>): DeepestReachesJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    sizeRange: raw["Size Range"]?.trim() ?? "",
    features: raw["Features"]?.trim() ?? "",
    description: raw["Description"]?.trim() ?? "",
  }
}

export function normalizeDeepestReachesModelName(raw: string): string {
  const trimmed = raw.trim()
  const alias = DEEPEST_REACHES_MODEL_NAME_ALIASES[trimmed.toLowerCase()]
  if (alias) return alias
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }
  return trimmed
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
export function resolveDeepestReachesModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function buildDeepestReachesModelDescription(row: DeepestReachesJsonRow): string | null {
  const parts = [
    row.description,
    row.features ? `Features:\n${row.features}` : "",
    row.sizeRange ? `Size range: ${row.sizeRange}` : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  return parts.join("\n\n")
}

export function isValidDeepestReachesJsonRow(row: DeepestReachesJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadDeepestReachesJsonRows(jsonPath: string): DeepestReachesJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toDeepestReachesJsonRow).filter(isValidDeepestReachesJsonRow)
}
