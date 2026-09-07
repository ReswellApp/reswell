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

export const CHRISTENSON_BRAND_SLUG = "christenson-surfboards"

export const DEFAULT_CHRISTENSON_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260811_195117.json",
)

export type ChristensonJsonRow = {
  surfboardName: string
  surfboardUrl: string
  surfboardImage: string
  surfboardDescription: string
  performanceCharacteristics: string
  specifications: string
}

export type ChristensonParsedDimension = {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
}

export type ChristensonVariantDraft = ChristensonParsedDimension & {
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  material: BrandModelVariantMaterial
}

export function toChristensonJsonRow(raw: Record<string, string>): ChristensonJsonRow {
  return {
    surfboardName: raw["Surfboard Name"]?.trim() ?? "",
    surfboardUrl: raw["Surfboard URL"]?.trim() ?? "",
    surfboardImage: raw["Surfboard Image"]?.trim() ?? "",
    surfboardDescription: raw["Surfboard Description"]?.trim() ?? "",
    performanceCharacteristics: raw["Performance Characteristics"]?.trim() ?? "",
    specifications: raw["Specifications"]?.trim() ?? "",
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
export function resolveChristensonModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function buildChristensonModelDescription(row: ChristensonJsonRow): string | null {
  const parts = [row.surfboardDescription, row.performanceCharacteristics]
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  return parts.join("\n\n")
}

/** All scraped Christenson models in this export are fish / fish hybrids. */
export function resolveChristensonBoardCategory(
  _row: ChristensonJsonRow,
): SurfboardSellCategoryKey {
  return "fish"
}

export function mapChristensonFinBoxes(row: ChristensonJsonRow): FinBoxesType {
  const blob = `${row.surfboardName}\n${row.surfboardDescription}\n${row.performanceCharacteristics}`
    .toLowerCase()
    .trim()

  if (blob.includes("quad")) return "quad"
  if (
    blob.includes("twin") ||
    blob.includes("keel") ||
    blob.includes("phish") ||
    blob.includes("fish")
  ) {
    return "twin_only"
  }
  return "twin_only"
}

export function mapChristensonFinBoxType(row: ChristensonJsonRow): FinBoxType {
  const blob = `${row.surfboardDescription}\n${row.performanceCharacteristics}`.toLowerCase()
  if (blob.includes("fcs") && !blob.includes("futures")) return "fcs_ii"
  return "futures"
}

export function mapChristensonMaterial(_row: ChristensonJsonRow): BrandModelVariantMaterial {
  return "pu_poly"
}

/** Split scrape blobs into individual dimension lines. */
export function splitChristensonDimensionEntries(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n")
  const entries: string[] = []

  for (const line of normalized.split("\n")) {
    const t = line.trim()
    if (!t) continue
    entries.push(t)
  }

  return entries
}

/**
 * Parse lines like:
 *   5'2 x 19 3/4 x 2 1/4 - 24.70L
 *   5'0 x 19 3/8 x 2 5/16
 */
export function parseChristensonDimensionEntry(line: string): ChristensonParsedDimension | null {
  const main = line.trim()
  if (!main) return null

  const volMatch = main.match(/\s*[-–—]\s*(\d+(?:\.\d+)?)\s*L\s*$/i)
  const volume_label = volMatch ? `${volMatch[1]}L` : ""
  const dimsPart = (volMatch?.index != null ? main.slice(0, volMatch.index) : main).trim()

  const parts = dimsPart.split(/\s+x\s+/i).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return null

  const length_label = parts[0]
  const width_label = parts[1]
  const thickness_label = parts.slice(2).join(" x ")

  if (!/^\d+'/.test(length_label)) return null

  return {
    length_label,
    width_label,
    thickness_label,
    volume_label,
  }
}

export function parseChristensonDimensions(raw: string): ChristensonParsedDimension[] {
  const seen = new Set<string>()
  const out: ChristensonParsedDimension[] = []

  for (const entry of splitChristensonDimensionEntries(raw)) {
    const parsed = parseChristensonDimensionEntry(entry)
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

export function buildChristensonVariantDrafts(row: ChristensonJsonRow): ChristensonVariantDraft[] {
  const fin_box_type = mapChristensonFinBoxType(row)
  const fin_boxes = mapChristensonFinBoxes(row)
  const material = mapChristensonMaterial(row)
  const dims = parseChristensonDimensions(row.specifications)

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
      },
    ]
  }

  return dims.map((d) => ({
    ...d,
    fin_box_type,
    fin_boxes,
    material,
  }))
}

export function isValidChristensonJsonRow(row: ChristensonJsonRow): boolean {
  return row.surfboardName.trim().length > 0
}

export function loadChristensonJsonRows(jsonPath: string): ChristensonJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toChristensonJsonRow).filter(isValidChristensonJsonRow)
}
