import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import type {
  BrandModelVariantMaterial,
  FinBoxesType,
  FinBoxType,
} from "@/lib/validations/brand-model-variants"

export const FIREWIRE_BRAND_SLUG = "firewire-surfboards"

export const DEFAULT_FIREWIRE_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260811_195843.json",
)

export type FirewireJsonRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  brand: string
  designer: string
  boardType: string
  productDescription: string
  color: string
  technology: string
  size: string
  waveType: string
  boardFeatures: string
}

export type FirewireParsedDimension = {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
}

export type FirewireVariantDraft = FirewireParsedDimension & {
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  material: BrandModelVariantMaterial
  price: number | null
}

export function toFirewireJsonRow(raw: Record<string, string>): FirewireJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    brand: raw["Brand"]?.trim() ?? "",
    designer: raw["Designer"]?.trim() ?? "",
    boardType: raw["Board Type"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    color: raw["Color"]?.trim() ?? "",
    technology: raw["Technology"]?.trim() ?? "",
    size: raw["Size"]?.trim() ?? "",
    waveType: raw["Wave Type"]?.trim() ?? "",
    boardFeatures: raw["Board Features"]?.trim() ?? "",
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
export function resolveFirewireModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function buildFirewireModelDescription(row: FirewireJsonRow): string | null {
  const parts = [
    row.productDescription,
    row.waveType ? `Wave type:\n${row.waveType}` : "",
    row.boardFeatures ? `Board features:\n${row.boardFeatures}` : "",
    row.designer ? `Designer: ${row.designer.replace(/\n+/g, ", ")}` : "",
    row.technology ? `Technology: ${row.technology.replace(/\n+/g, "; ")}` : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  return parts.join("\n\n")
}

function mapBoardTypeToken(token: string): SurfboardSellCategoryKey | null {
  const t = token.trim().toLowerCase()
  if (!t) return null
  if (t.includes("longboard")) return "longboard"
  if (t.includes("step up") || t.includes("step-up") || t.includes("gun")) {
    return "step-up-gun"
  }
  if (t.includes("groveler")) return "groveler"
  if (t.includes("fish")) return "fish"
  if (t.includes("midlength") || t.includes("mid-length") || t.includes("mid length")) {
    return "hybrid"
  }
  if (t.includes("hybrid")) return "hybrid"
  if (t.includes("shortboard") || t.includes("performance")) return "shortboard"
  return null
}

/** Map Firewire scrape board-type labels onto Reswell sell category keys. */
export function resolveFirewireBoardCategory(row: FirewireJsonRow): SurfboardSellCategoryKey {
  const tokens = row.boardType
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const mapped = mapBoardTypeToken(token)
    if (mapped) return mapped
  }

  return "other"
}

export function mapFirewireFinBoxes(row: FirewireJsonRow): FinBoxesType {
  const blob = `${row.productName}\n${row.productDescription}\n${row.boardFeatures}\n${row.size}`
    .toLowerCase()
    .trim()

  if (/\b5\s*fin\b/.test(blob) || blob.includes("five fin") || blob.includes("5 fin boxes")) {
    return "five"
  }
  if (blob.includes("2+1") || blob.includes("2 + 1") || blob.includes("two plus one")) {
    return "twin"
  }
  if (blob.includes("quad")) return "quad"
  if (blob.includes("thruster")) return "thruster"
  if (blob.includes("twin") || blob.includes("keel")) return "twin_only"
  if (blob.includes("single fin") || /\bsingle\b/.test(blob)) return "single"
  return "thruster"
}

export function mapFirewireFinBoxType(row: FirewireJsonRow): FinBoxType {
  const blob = `${row.productDescription}\n${row.boardFeatures}\n${row.size}`.toLowerCase()
  if (blob.includes("2+1") || blob.includes("2 + 1") || blob.includes("two plus one")) {
    if (blob.includes("fcs") && !blob.includes("futures")) return "two_plus_one_fcs"
    return "two_plus_one_futures"
  }
  if (blob.includes("fcs") && !blob.includes("futures")) return "fcs_ii"
  if (blob.includes("single fin") && !blob.includes("futures") && !blob.includes("fcs")) {
    return "single"
  }
  return "futures"
}

/** Firewire stock builds are EPS/epoxy constructions (Helium, I-Bolic, G-Flex, etc.). */
export function mapFirewireMaterial(row: FirewireJsonRow): BrandModelVariantMaterial {
  const blob = `${row.productName}\n${row.technology}`.toLowerCase()
  if (blob.includes("carbonyx") || blob.includes("carbon")) return "carbon"
  if (
    blob.includes("i-bolic") ||
    blob.includes("ibolic") ||
    blob.includes("helium") ||
    blob.includes("g-flex") ||
    blob.includes("gflex") ||
    blob.includes("volcanic") ||
    blob.includes("eps") ||
    blob.includes("epoxy")
  ) {
    return "eps_epoxy"
  }
  if (blob.includes("pu") || blob.includes("polyester")) return "pu_poly"
  return "eps_epoxy"
}

/**
 * Thunderbit stores Size as a stringified JSON array with awkward inch quoting, e.g.
 * `["5'4"" x 18 1/8"" x 2 1/4"" x 23.7L", ...]`.
 */
export function splitFirewireSizeEntries(raw: string): string[] {
  const t = raw.trim()
  if (!t || t === "[]") return []

  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim()
    if (!inner) return []
    return inner
      .split(/","/)
      .map((part) => part.trim().replace(/^"+|"+$/g, "").replace(/""/g, '"'))
      .filter(Boolean)
  }

  return t
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Parse lines like:
 *   5'4" x 18 1/8" x 2 1/4" x 23.7L
 *   4'8" 16 1/2" x 2" x 16.7L
 *   6'x 19 3/8" x 2 11/16" x 33.25L
 *   9'3" x 23 1/4" x 3 1/8" x 77.4L (Two Plus One)
 */
export function parseFirewireDimensionEntry(line: string): FirewireParsedDimension | null {
  let main = line.trim().replace(/""/g, '"')
  if (!main) return null

  main = main.replace(/\s*\([^)]*\)\s*$/g, "").trim()
  // Missing `x` after length: 4'8" 16 1/2" x ...
  main = main.replace(/^(\d+'\d*"?)\s+(?=[\d])/, "$1 x ")
  // Compact feet-only length: 6'x 19 ...
  main = main.replace(/^(\d+')\s*x\s*/i, "$1 x ")

  const volMatch = main.match(/\s*(?:x\s*)?(\d+(?:\.\d+)?)\s*L\s*$/i)
  if (!volMatch || volMatch.index == null) return null

  const volume_label = `${volMatch[1]}L`
  const dimsPart = main.slice(0, volMatch.index).trim().replace(/\s*x\s*$/i, "").trim()
  const parts = dimsPart
    .split(/\s+x\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length < 3) return null

  const length_label = parts[0]
  if (!/^\d+'/.test(length_label)) return null

  return {
    length_label,
    width_label: parts[1],
    thickness_label: parts.slice(2).join(" x "),
    volume_label,
  }
}

export function parseFirewireDimensions(raw: string): FirewireParsedDimension[] {
  const seen = new Set<string>()
  const out: FirewireParsedDimension[] = []

  for (const entry of splitFirewireSizeEntries(raw)) {
    const parsed = parseFirewireDimensionEntry(entry)
    if (!parsed) continue
    const key = [
      parsed.length_label,
      parsed.width_label,
      parsed.thickness_label,
      parsed.volume_label,
    ]
      .map((s) => s.toLowerCase())
      .join("|")
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
  }

  return out
}

export function buildFirewireVariantDrafts(row: FirewireJsonRow): FirewireVariantDraft[] {
  const price = row.priceUsd ? Number(row.priceUsd) : null
  const safePrice = price != null && Number.isFinite(price) && price > 0 ? price : null
  const fin_box_type = mapFirewireFinBoxType(row)
  const fin_boxes = mapFirewireFinBoxes(row)
  const material = mapFirewireMaterial(row)
  const dims = parseFirewireDimensions(row.size)

  if (dims.length === 0) {
    return [
      {
        length_label: "",
        width_label: "",
        thickness_label: "",
        volume_label: "",
        fin_box_type,
        fin_boxes,
        material,
        price: safePrice,
      },
    ]
  }

  return dims.map((d) => ({
    ...d,
    fin_box_type,
    fin_boxes,
    material,
    price: safePrice,
  }))
}

export function isValidFirewireJsonRow(row: FirewireJsonRow): boolean {
  const name = row.productName.trim()
  if (!name) return false
  if (/gift\s*card/i.test(name)) return false
  return true
}

/** Keep the richest row per product name (duplicate scrape variants / constructions). */
export function dedupeFirewireJsonRows(rows: FirewireJsonRow[]): FirewireJsonRow[] {
  const byName = new Map<string, FirewireJsonRow>()

  for (const row of rows) {
    const key = row.productName.trim().toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, row)
      continue
    }

    const existingDims = parseFirewireDimensions(existing.size).length
    const nextDims = parseFirewireDimensions(row.size).length
    const existingScore =
      existingDims * 10 +
      (existing.productDescription ? 2 : 0) +
      (existing.technology ? 1 : 0) +
      (existing.productImage ? 1 : 0)
    const nextScore =
      nextDims * 10 +
      (row.productDescription ? 2 : 0) +
      (row.technology ? 1 : 0) +
      (row.productImage ? 1 : 0)

    if (nextScore > existingScore) {
      byName.set(key, row)
    }
  }

  return [...byName.values()]
}

export function loadFirewireJsonRows(jsonPath: string): FirewireJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return dedupeFirewireJsonRows(parsed.map(toFirewireJsonRow).filter(isValidFirewireJsonRow))
}
