import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { isValidHttpImageSource } from "@/lib/services/brandCatalogImageStorage"
import { parseThunderbitCsv } from "@/lib/services/trueAmesFinCatalogCsv"
import type {
  BrandModelVariantMaterial,
  FinBoxesType,
  FinCatalogVariantSize,
} from "@/lib/validations/brand-model-variants"

export type FuturesFinCsvRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  finSetup: string
  templateCategory: string
  finSize: string
  productDescription: string
  suggestedWaveType: string
  constructionMaterial: string
  sideFinsArea: string
  sideFinsHeight: string
  sideFinsBase: string
  sideFinsAngle: string
  sideFinsFoil: string
  centerFinArea: string
  centerFinHeight: string
  centerFinBase: string
  centerFinFoil: string
  productVariantImages: string
}

export const FUTURES_FINS_BRAND_ID = "6bdb1f75-a196-4c04-a170-cb8d8f72bdd6"

export const DEFAULT_FUTURES_FIN_CSV = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260626_005846.csv",
)

export function toFuturesFinCsvRow(raw: Record<string, string>): FuturesFinCsvRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    finSetup: raw["Fin Setup"]?.trim() ?? "",
    templateCategory: raw["Template Category"]?.trim() ?? "",
    finSize: raw["Fin Size"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    suggestedWaveType: raw["Suggested Wave Type"]?.trim() ?? "",
    constructionMaterial: raw["Construction Material"]?.trim() ?? "",
    sideFinsArea: raw["Side Fins Area"]?.trim() ?? "",
    sideFinsHeight: raw["Side Fins Height"]?.trim() ?? "",
    sideFinsBase: raw["Side Fins Base"]?.trim() ?? "",
    sideFinsAngle: raw["Side Fins Angle"]?.trim() ?? "",
    sideFinsFoil: raw["Side Fins Foil"]?.trim() ?? "",
    centerFinArea: raw["Center Fin Area"]?.trim() ?? "",
    centerFinHeight: raw["Center Fin Height"]?.trim() ?? "",
    centerFinBase: raw["Center Fin Base"]?.trim() ?? "",
    centerFinFoil: raw["Center Fin Foil"]?.trim() ?? "",
    productVariantImages: raw["Product Variant Images"]?.trim() ?? "",
  }
}

function splitImageUrls(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (u): u is string => typeof u === "string" && isValidHttpImageSource(u),
        )
      }
    } catch {
      // fall through
    }
  }
  return t
    .split(/\s+/)
    .map((part) => part.replace(/[)\]},.]+$/, ""))
    .filter((u) => isValidHttpImageSource(u))
}

/** Prefer full hero photos over Futures Shopify thumbnails (`_180x`, `_120x`, …). */
export function preferFuturesProductImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  if (/_50x/i.test(t)) return t.replace(/_50x/gi, "_600x")
  if (/_120x/i.test(t)) return t.replace(/_120x/gi, "_600x")
  if (/_180x/i.test(t)) return t.replace(/_180x/gi, "_600x")
  if (/_360x(?!\d)/i.test(t)) return t.replace(/_360x(?!\d)/gi, "_600x504")
  return t
}

export function resolveFuturesModelImageFromCsv(row: FuturesFinCsvRow): string | null {
  const candidates = [
    row.productImage,
    ...splitImageUrls(row.productVariantImages),
  ]
    .map(preferFuturesProductImageUrl)
    .filter((u) => isValidHttpImageSource(u))

  return candidates[0] ?? null
}

export function mapFuturesFinBoxes(finSetup: string, productName: string): FinBoxesType {
  const t = finSetup.trim().toLowerCase()
  const name = productName.trim().toLowerCase()

  if (t.includes("5 fin")) return "five"
  if (t.includes("quad")) return "quad"
  if (t.includes("thruster")) return "thruster"
  if (t.includes("twin") || name.includes("twin")) return "twin"
  if (t.includes("longboard") || name.includes("single fin")) return "single"
  return "other"
}

export function mapFuturesFinSize(
  finSize: string,
  productName: string,
): FinCatalogVariantSize | null {
  const t = finSize.trim().toLowerCase()
  if (t.includes("grom") || t.includes("x-small")) return "xs"
  if (t === "small" || t === "s") return "s"
  if (t === "medium" || t === "m") return "m"
  if (t === "large" || t === "l") return "l"
  if (t.includes("x-large") || t === "xl") return "xl"
  if (t === "pro") return "l"

  const nameMatch = productName.match(/\(([^)]+)\)/)
  const token = nameMatch?.[1]?.trim().toLowerCase() ?? ""
  if (token === "grom") return "xs"
  if (token === "s" || token === "sm") return "s"
  if (token === "m" || token === "md") return "m"
  if (token === "l" || token === "lg") return "l"
  if (token === "xl") return "xl"

  return null
}

export function mapFuturesMaterial(raw: string): BrandModelVariantMaterial {
  const v = raw.trim().toLowerCase()
  if (!v || /^https?:/i.test(v)) return "other"
  if (v.includes("carbon") || v.includes("blackstix") || v.includes("texalium")) return "carbon"
  if (v.includes("honeycomb") || v.includes("vapor")) return "eps_epoxy"
  if (
    v.includes("fiberglass") ||
    v.includes("alpha") ||
    v.includes("techflex") ||
    v.includes("solid")
  ) {
    return "pu_poly"
  }
  return "other"
}

function joinDim(side: string, center: string, label: string): string {
  const s = side.trim()
  const c = center.trim()
  if (s && c && s !== c) return `${label}: ${s} / Center: ${c}`
  return s || c
}

export function isValidFuturesFinCsvRow(row: FuturesFinCsvRow): boolean {
  if (!row.productName.trim()) return false
  if (/^https?:/i.test(row.constructionMaterial.trim())) return false
  if (/^https?:/i.test(row.sideFinsHeight.trim())) return false
  return true
}

export type FuturesFinVariantDraft = {
  fin_boxes: FinBoxesType
  fin_size: FinCatalogVariantSize | null
  material: BrandModelVariantMaterial
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  price: number | null
  image_url: string | null
}

export function buildFuturesVariantDraft(row: FuturesFinCsvRow): FuturesFinVariantDraft {
  const price = row.priceUsd ? Number(row.priceUsd) : null
  const safePrice = price != null && Number.isFinite(price) && price > 0 ? price : null

  const configParts = [row.finSetup, row.templateCategory, row.constructionMaterial]
    .map((s) => s.trim())
    .filter((s) => s && !/^https?:/i.test(s))

  const modelImage = resolveFuturesModelImageFromCsv(row)

  return {
    fin_boxes: mapFuturesFinBoxes(row.finSetup, row.productName),
    fin_size: mapFuturesFinSize(row.finSize, row.productName),
    material: mapFuturesMaterial(row.constructionMaterial),
    configuration_label: configParts.join(" · "),
    fin_base_label: joinDim(row.sideFinsBase, row.centerFinBase, "Side base"),
    fin_height_label: joinDim(row.sideFinsHeight, row.centerFinHeight, "Side height"),
    fin_foil_label: joinDim(row.sideFinsFoil, row.centerFinFoil, "Side foil"),
    price: safePrice,
    image_url: modelImage,
  }
}

export function buildFuturesModelDescription(row: FuturesFinCsvRow): string | null {
  const parts = [row.productDescription, row.suggestedWaveType, row.templateCategory]
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join("\n\n") : null
}

export function loadFuturesFinCsvRows(csvPath: string): FuturesFinCsvRow[] {
  const text = readFileSync(csvPath, "utf8")
  return parseThunderbitCsv(text)
    .map(toFuturesFinCsvRow)
    .filter(isValidFuturesFinCsvRow)
}

export function loadFuturesFinCsvByProductName(csvPath: string): Map<string, FuturesFinCsvRow> {
  const map = new Map<string, FuturesFinCsvRow>()
  for (const row of loadFuturesFinCsvRows(csvPath)) {
    map.set(row.productName, row)
  }
  return map
}
