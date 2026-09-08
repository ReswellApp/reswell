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
  "Downloads/Thunderbit_0b8b19_20260704_002556.json",
)

export type ChannelIslandsJsonRow = {
  productName: string
  productDescription: string
  productImage: string
}

/** Near-duplicate / alternate spellings → canonical CI catalog names. */
export const CHANNEL_ISLANDS_MODEL_NAME_ALIASES: Readonly<Record<string, string>> = {
  "2.pro": "CI 2.Pro",
  "ci 2.pro ect": "CI 2.Pro",
  "high-5": "High 5",
  "high five": "High 5",
  m13: "The M13",
  "new flyer": "The New Flyer",
  tlow: "T-Low",
  waterhog: "The Water Hog",
  "black beauty": "The Black Beauty",
  "black/white": "Black and White",
  "black & white": "Black and White",
  "rocket wide sqaush": "Rocket Wide Squash",
  sp12: "Semi Pro 12",
  msf: "The MSF G2",
  mini: "Mini Eco-hybrid",
  "ci mid": "CI Mid",
  "x-lite pod mod black": "Pod Mod",
}

/**
 * Construction / soft-goods suffixes that should not create a separate catalog model
 * when a base model already exists.
 */
const CONSTRUCTION_SUFFIX =
  /\s+(?:spine-?tek|spinetek|ect(?:\s+epoxy)?|x-?lite(?:\s+pod\s+mod)?(?:\s+black)?)\s*$/i

function applyChannelIslandsModelAlias(name: string): string {
  const key = name.trim().toLowerCase()
  return CHANNEL_ISLANDS_MODEL_NAME_ALIASES[key] ?? name.trim()
}

export function toChannelIslandsJsonRow(raw: Record<string, string>): ChannelIslandsJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() || raw["Product Images"]?.trim() || "",
  }
}

/** Strip Shopify size/fin/construction noise and map known aliases to canonical names. */
export function normalizeChannelIslandsModelName(raw: string): string {
  let name = raw.trim()
  // Drop leading stock length ("5'10 CI 2.Pro - FCSII")
  name = name.replace(/^\d+'\d*"?\s+/i, "")
  name = name.replace(/\s+-\s+(?:FCS\s*II?|FCSII|Futures?|Future\s*Flex|EPS\s*Soft?)\s*$/i, "")
  name = name.replace(CONSTRUCTION_SUFFIX, "")
  name = name.replace(/\s+/g, " ").trim()
  return applyChannelIslandsModelAlias(name)
}

/** Reject used/trade-in SKUs and truncated scrape junk. */
export function isChannelIslandsCatalogModelName(name: string): boolean {
  const n = name.trim()
  if (n.length < 2) return false
  if (/^the$/i.test(n)) return false
  if (/\bused\s+team\s+board\b/i.test(n)) return false
  if (/\bteam\s+trade[\s-]?in\b/i.test(n)) return false
  if (/^1\/2\b/i.test(n)) return false
  return true
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
  if (!row.productName.trim()) return false
  const normalized = normalizeChannelIslandsModelName(row.productName)
  return isChannelIslandsCatalogModelName(normalized)
}

export function loadChannelIslandsJsonRows(jsonPath: string): ChannelIslandsJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toChannelIslandsJsonRow).filter(isValidChannelIslandsJsonRow)
}
