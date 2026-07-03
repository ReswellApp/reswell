import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"
import type {
  BrandModelVariantMaterial,
  FinBoxesType,
  FinBoxType,
} from "@/lib/validations/brand-model-variants"

export const HAYDEN_SHAPES_BRAND_SLUG = "hayden-shapes"

export const DEFAULT_HAYDEN_SHAPES_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260703_203527.json",
)

export type HaydenShapesJsonRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  modelOverview: string
  skillLevel: string
  conditions: string
  suitableWaveFaces: string
  technology: string
  finSystem: string
  dimensions: string
}

export type HaydenShapesParsedDimension = {
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
}

export type HaydenShapesVariantDraft = HaydenShapesParsedDimension & {
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  material: BrandModelVariantMaterial
  price: number | null
}

export function toHaydenShapesJsonRow(raw: Record<string, string>): HaydenShapesJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    modelOverview: raw["Model Overview"]?.trim() ?? "",
    skillLevel: raw["Skill Level"]?.trim() ?? "",
    conditions: raw["Conditions"]?.trim() ?? "",
    suitableWaveFaces: raw["Suitable Wave Faces"]?.trim() ?? "",
    technology: raw["Technology"]?.trim() ?? "",
    finSystem: raw["Fin System"]?.trim() ?? "",
    dimensions: raw["Dimensions"]?.trim() ?? "",
  }
}

function splitImageUrls(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  return t
    .split(/\s+/)
    .map((part) => part.replace(/[)\]},.]+$/, ""))
    .filter((u) => isValidHttpImageSource(u))
}

/** Prefer the first valid hero image from newline-separated scrape values. */
export function resolveHaydenShapesModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  return candidates[0] ?? extractFirstHttpImageUrl(raw)
}

export function buildHaydenShapesModelDescription(row: HaydenShapesJsonRow): string | null {
  const parts = [
    row.modelOverview,
    row.skillLevel ? `Skill level: ${row.skillLevel}` : "",
    row.conditions ? `Conditions: ${row.conditions}` : "",
    row.suitableWaveFaces ? `Wave faces: ${row.suitableWaveFaces}` : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  return parts.join("\n\n")
}

export function mapHaydenShapesMaterial(
  productName: string,
  technology: string,
): BrandModelVariantMaterial {
  const name = productName.trim().toLowerCase()
  const techLines = technology
    .split(/\n+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (name.includes("carbonyx") || techLines.some((t) => t.includes("carbonyx"))) {
    return "carbon"
  }
  if (name.includes("futureflex") || techLines.some((t) => t === "futureflex")) {
    return "carbon"
  }
  if (name.includes("eps soft") || techLines.some((t) => t.includes("eps soft"))) {
    return "eps_epoxy"
  }
  if (techLines.some((t) => t === "eps" || t.startsWith("eps "))) {
    return "eps_epoxy"
  }
  if (techLines.some((t) => t === "pu" || t.startsWith("pu "))) {
    return "pu_poly"
  }
  if (name.includes(" eps")) return "eps_epoxy"
  return "pu_poly"
}

function mapHaydenFinBoxes(finSystem: string): FinBoxesType {
  const t = finSystem.trim().toLowerCase()
  if (t.includes("single fin")) return "single"
  if (t.includes("2+1")) return "twin"
  if (t.includes("twin")) return "twin"
  if (/\b5\b/.test(t) || t.includes(" 5")) return "five"
  if (/\b3\b/.test(t) || t.includes(" 3")) return "thruster"
  if (t.includes("quad")) return "quad"
  return "thruster"
}

function mapHaydenFinBoxType(finSystem: string): FinBoxType {
  const lines = finSystem
    .split(/\n+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const t = (lines[0] ?? finSystem).trim().toLowerCase()

  if (t.includes("single fin")) return "single"
  if (t.includes("fcs")) return "fcs_ii"
  if (t.includes("2+1") && t.includes("fcs")) return "two_plus_one_fcs"
  if (t.includes("2+1")) return "two_plus_one_futures"
  if (t.includes("futures") || t.includes("future")) return "futures"
  return "futures"
}

function normalizeDimensionsRaw(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/■/g, "\n")
    .replace(/\s--\s/g, "\n")
}

/** Split scrape blobs into individual dimension lines (handles missing newlines). */
export function splitHaydenShapesDimensionEntries(raw: string): string[] {
  const normalized = normalizeDimensionsRaw(raw)
  const withBreaks = normalized.replace(/(?<!\n)(\d+'\d*"?)/g, "\n$1")
  const entries: string[] = []

  for (const line of withBreaks.split("\n")) {
    const t = line.trim()
    if (!t) continue
    if (/custom dimensions/i.test(t)) continue
    if (/dimensions loading/i.test(t)) continue
    if (/^(?:made to order|in stock|in production|\d+\+ available)$/i.test(t)) continue
    entries.push(t)
  }

  return entries
}

export function parseHaydenShapesDimensionEntry(line: string): HaydenShapesParsedDimension | null {
  const main = line
    .trim()
    .replace(/\s*(?:--|■).*$/i, "")
    .trim()

  const volMatch =
    main.match(/(?:[-x×]\s*)?(\d+(?:\.\d+)?)\s*L\s*$/i) ??
    main.match(/(?:[-x×]\s*)?(\d+(?:\.\d+)?)\s*$/i)

  if (!volMatch || volMatch.index == null) return null

  const volume_label = `${volMatch[1]}L`
  const dimsPart = main.slice(0, volMatch.index).trim()
  const lenMatch = dimsPart.match(/^(\d+'\d*"?)\s*(?:x\s*)?(.*)$/i)
  if (!lenMatch) return null

  const length_label = lenMatch[1].trim()
  const rest = lenMatch[2].trim()
  if (!rest) return null

  const xParts = rest.split(/\s+x\s+/i)
  if (xParts.length >= 2) {
    return {
      length_label,
      width_label: xParts[0].trim(),
      thickness_label: xParts.slice(1).join(" x ").trim(),
      volume_label,
    }
  }

  const spaceMatch = rest.match(/^([\d\s\/".]+?)\s+([\d\s\/".]+)$/)
  if (spaceMatch) {
    return {
      length_label,
      width_label: spaceMatch[1].trim(),
      thickness_label: spaceMatch[2].trim(),
      volume_label,
    }
  }

  return null
}

export function parseHaydenShapesDimensions(raw: string): HaydenShapesParsedDimension[] {
  const seen = new Set<string>()
  const out: HaydenShapesParsedDimension[] = []

  for (const entry of splitHaydenShapesDimensionEntries(raw)) {
    const parsed = parseHaydenShapesDimensionEntry(entry)
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

export function buildHaydenShapesVariantDrafts(row: HaydenShapesJsonRow): HaydenShapesVariantDraft[] {
  const price = row.priceUsd ? Number(row.priceUsd) : null
  const safePrice = price != null && Number.isFinite(price) && price > 0 ? price : null
  const material = mapHaydenShapesMaterial(row.productName, row.technology)
  const fin_box_type = mapHaydenFinBoxType(row.finSystem)
  const fin_boxes = mapHaydenFinBoxes(row.finSystem)
  const dims = parseHaydenShapesDimensions(row.dimensions)

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

export function isValidHaydenShapesJsonRow(row: HaydenShapesJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadHaydenShapesJsonRows(jsonPath: string): HaydenShapesJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toHaydenShapesJsonRow).filter(isValidHaydenShapesJsonRow)
}
