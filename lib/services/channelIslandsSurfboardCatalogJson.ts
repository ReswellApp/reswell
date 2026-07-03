import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"

export const CHANNEL_ISLANDS_BRAND_SLUG = "channel-islands-surfboards"

export const DEFAULT_CHANNEL_ISLANDS_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260703_205041.json",
)

export type ChannelIslandsJsonRow = {
  productName: string
  productDescription: string
  productImage: string
}

export function toChannelIslandsJsonRow(raw: Record<string, string>): ChannelIslandsJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
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
export function resolveChannelIslandsModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function buildChannelIslandsModelDescription(row: ChannelIslandsJsonRow): string | null {
  const description = row.productDescription.trim()
  return description || null
}

export function isValidChannelIslandsJsonRow(row: ChannelIslandsJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadChannelIslandsJsonRows(jsonPath: string): ChannelIslandsJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toChannelIslandsJsonRow).filter(isValidChannelIslandsJsonRow)
}
