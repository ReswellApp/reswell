import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { isValidHttpImageSource } from "@/lib/services/brandCatalogImageStorage"
import { parseThunderbitCsv, preferFullProductImageUrl } from "@/lib/services/trueAmesFinCatalogCsv"
import type {
  FinBoxesType,
  FinBoxType,
  FinCatalogVariantSize,
} from "@/lib/validations/brand-model-variants"

export type FcsFinCsvRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  material: string
  finSystem: string
  availability: string
  sizes: string
  colors: string
  productOverview: string
  dimMedSide: string
  dimMedCenter: string
  dimLrgSide: string
  dimLrgCenter: string
  dimXlSide: string
  dimXlCenter: string
  productImageVariants: string
  productColorVariants: string
}

export const DEFAULT_FCS_FIN_CSV = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260625_234921.csv",
)

export type FcsVariantDraft = {
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  fin_size: FinCatalogVariantSize | null
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  fin_color_label: string
  price: number | null
  image_url: string | null
}

function splitLines(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      }
    } catch {
      // fall through
    }
  }
  return t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function toFcsFinCsvRow(raw: Record<string, string>): FcsFinCsvRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    material: raw["Material"]?.trim() ?? "",
    finSystem: raw["Fin System"]?.trim() ?? "",
    availability: raw["Availability"]?.trim() ?? "",
    sizes: raw["Size"]?.trim() ?? "",
    colors: raw["Color"]?.trim() ?? "",
    productOverview: raw["Product Overview"]?.trim() ?? "",
    dimMedSide: raw["Fin Dimensions (Medium Side Fin)"]?.trim() ?? "",
    dimMedCenter: raw["Fin Dimensions (Medium Center Fin)"]?.trim() ?? "",
    dimLrgSide: raw["Fin Dimensions (Large Side Fin)"]?.trim() ?? "",
    dimLrgCenter: raw["Fin Dimensions (Large Center Fin)"]?.trim() ?? "",
    dimXlSide: raw["Fin Dimensions (X-Large Side Fin)"]?.trim() ?? "",
    dimXlCenter: raw["Fin Dimensions (X-Large Center Fin)"]?.trim() ?? "",
    productImageVariants:
      raw["Product Image Varaints"]?.trim() ?? raw["Product Image Variants"]?.trim() ?? "",
    productColorVariants: raw["Product Color Variants"]?.trim() ?? "",
  }
}

function parseImageVariants(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((u): u is string => typeof u === "string" && isValidHttpImageSource(u))
          .map(preferFullProductImageUrl)
      }
    } catch {
      // fall through
    }
  }
  return splitLines(t)
    .flatMap((line) => line.split(/\s+/))
    .filter((u) => isValidHttpImageSource(u))
    .map(preferFullProductImageUrl)
}

function pickImageForColor(fallback: string, color: string, variantUrls: string[]): string {
  if (!color.trim()) return fallback
  const colorKey = color.trim().toLowerCase()
  const aliases: Record<string, string[]> = {
    smoke: ["smoke", "smk"],
    clear: ["clear", "clr"],
    "pulse green": ["pulse", "green", "pulse-green"],
    flux: ["flux"],
    "black/white": ["bw", "black", "white", "black-white"],
    "white/blue": ["white", "blue", "wht", "blu"],
    ivory: ["ivory"],
    sand: ["sand"],
    red: ["red"],
    blue: ["blue", "blu"],
    green: ["green", "grn"],
    black: ["black", "blk"],
    white: ["white", "wht"],
  }
  const needles = aliases[colorKey] ?? colorKey.split(/[/\s-]+/).filter(Boolean)
  for (const url of variantUrls) {
    const lower = url.toLowerCase()
    if (needles.some((n) => n.length > 1 && lower.includes(n))) return url
  }
  return fallback
}

export function mapFcsFinBoxType(raw: string, productName: string): FinBoxType {
  const v = raw.trim().toLowerCase()
  const name = productName.toLowerCase()
  if (v.includes("fcs ii") || name.includes("fcs ii")) return "fcs_ii"
  if (v === "fcs" || v.includes("fcs twin")) return "fcs_twin_tab"
  if (v.includes("screw") || name.includes("screw")) return "single"
  return "fcs_ii"
}

export function mapFcsFinBoxes(productName: string): FinBoxesType {
  const n = productName.toLowerCase()
  if (n.includes("quad")) return "quad"
  if (n.includes("twin") || n.includes("keel")) return "twin"
  if (n.includes("tri") || n.includes("thruster")) return "thruster"
  if (n.includes("5-fin") || n.includes("five fin")) return "five"
  if (n.includes("single")) return "single"
  return "other"
}

function normalizeSizeToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ")
}

function mapFinSize(sizeLabel: string): FinCatalogVariantSize | null {
  const s = normalizeSizeToken(sizeLabel)
  if (s === "XS" || s === "X-SMALL") return "xs"
  if (s === "S" || s === "SM" || s === "SML" || s === "SMALL") return "s"
  if (s === "MED" || s === "M" || s === "MEDIUM") return "m"
  if (s === "LRG" || s === "L" || s === "LARGE") return "l"
  if (s === "XL" || s === "X-LARGE" || s === "XLARGE") return "xl"
  return null
}

function dimensionRawForSize(row: FcsFinCsvRow, sizeLabel: string): string {
  const s = normalizeSizeToken(sizeLabel)
  if (s === "MED" || s === "M" || s === "MEDIUM") return row.dimMedSide || row.dimMedCenter
  if (s === "LRG" || s === "L" || s === "LARGE") return row.dimLrgSide || row.dimLrgCenter
  if (s === "XL" || s === "X-LARGE" || s === "XLARGE") return row.dimXlSide || row.dimXlCenter
  return ""
}

function parseFcsDimensionString(raw: string): {
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
} {
  const baseIn = raw.match(/Base \(inches\):\s*([^,]+)/i)
  const depthIn = raw.match(/Depth \(inches\):\s*([^,]+)/i)
  const foil = raw.match(/Foil:\s*([^,\n]+)/i)
  return {
    fin_base_label: baseIn?.[1]?.trim() ?? "",
    fin_height_label: depthIn?.[1]?.trim() ? `${depthIn[1].trim()}"` : "",
    fin_foil_label: foil?.[1]?.trim() ?? "",
  }
}

export function buildFcsVariantDrafts(row: FcsFinCsvRow): FcsVariantDraft[] {
  const price = row.priceUsd ? Number(row.priceUsd) : null
  const safePrice = price != null && Number.isFinite(price) && price > 0 ? price : null
  const finBoxType = mapFcsFinBoxType(row.finSystem, row.productName)
  const finBoxes = mapFcsFinBoxes(row.productName)
  const configurationLabel = [row.material, row.finSystem].filter(Boolean).join(" · ")
  const sizes = splitLines(row.sizes)
  const colors = splitList(row.colors.length > 0 ? row.colors : row.productColorVariants)
  const variantImages = parseImageVariants(row.productImageVariants)
  const fallbackImage = preferFullProductImageUrl(row.productImage)

  const sizeOptions = sizes.length > 0 ? sizes : [""]
  const colorOptions = colors.length > 0 ? colors : [""]

  const drafts: FcsVariantDraft[] = []
  for (const size of sizeOptions) {
    for (const color of colorOptions) {
      const geometry = parseFcsDimensionString(dimensionRawForSize(row, size))
      const sizeLabel = normalizeSizeToken(size)
      drafts.push({
        fin_box_type: finBoxType,
        fin_boxes: finBoxes,
        fin_size: sizeLabel ? mapFinSize(sizeLabel) : null,
        configuration_label: configurationLabel,
        fin_base_label: geometry.fin_base_label,
        fin_height_label: sizeLabel || geometry.fin_height_label,
        fin_foil_label: geometry.fin_foil_label,
        fin_color_label: color,
        price: safePrice,
        image_url:
          pickImageForColor(fallbackImage ?? "", color, variantImages) || fallbackImage || null,
      })
    }
  }
  return drafts
}

export function loadFcsFinCsvByProductName(csvPath: string): Map<string, FcsFinCsvRow> {
  const text = readFileSync(csvPath, "utf8")
  const map = new Map<string, FcsFinCsvRow>()
  for (const raw of parseThunderbitCsv(text)) {
    const row = toFcsFinCsvRow(raw)
    if (row.productName) map.set(row.productName, row)
  }
  return map
}

export function resolveFcsModelImageFromCsv(row: FcsFinCsvRow): string | null {
  const url = preferFullProductImageUrl(row.productImage)
  return isValidHttpImageSource(url) ? url : null
}

export function resolveFcsVariantImageFromCsv(row: FcsFinCsvRow, colorLabel: string): string | null {
  const variantImages = parseImageVariants(row.productImageVariants)
  const fallback = preferFullProductImageUrl(row.productImage)
  const picked = pickImageForColor(fallback, colorLabel, variantImages)
  const candidate = picked?.trim() || fallback || null
  return isValidHttpImageSource(candidate)
    ? candidate
    : isValidHttpImageSource(fallback)
      ? fallback
      : null
}

export function loadFcsFinCsvRows(csvPath: string): FcsFinCsvRow[] {
  const text = readFileSync(csvPath, "utf8")
  return parseThunderbitCsv(text).map(toFcsFinCsvRow).filter((r) => r.productName.length > 0)
}
