import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { isValidHttpImageSource } from "@/lib/services/brandCatalogImageStorage"
import type {
  BrandModelVariantMaterial,
  FinBoxesType,
  FinBoxType,
  FinCatalogVariantSize,
} from "@/lib/validations/brand-model-variants"

export const GRINDHOUSE_FINS_BRAND_ID = "5a86f8a9-16da-418f-b53c-0a92fbc60865"
export const GRINDHOUSE_FINS_BRAND_SLUG = "grindhouse"

export const DEFAULT_GRINDHOUSE_FIN_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260704_140608.json",
)

export type GrindhouseFinJsonRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  productDescription: string
  constructionMaterial: string
}

export type GrindhouseFinVariantDraft = {
  fin_box_type: FinBoxType
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

export function toGrindhouseFinJsonRow(raw: Record<string, string>): GrindhouseFinJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    constructionMaterial: raw["Construction Material"]?.trim() ?? "",
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

/** Prefer larger Shopify CDN images over Thunderbit thumbnail width. */
export function preferGrindhouseProductImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  if (/[?&]width=\d+/i.test(t)) {
    return t.replace(/([?&]width=)\d+/i, "$11200")
  }
  return t
}

export function resolveGrindhouseModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw).map(preferGrindhouseProductImageUrl)
  return candidates[0] ?? null
}

export function isValidGrindhouseFinJsonRow(row: GrindhouseFinJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadGrindhouseFinJsonRows(jsonPath: string): GrindhouseFinJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toGrindhouseFinJsonRow).filter(isValidGrindhouseFinJsonRow)
}

function stripMarkdown(raw: string): string {
  return raw.replace(/\*\*/g, "").trim()
}

function parsePrice(raw: string): number | null {
  const price = raw ? Number(raw) : null
  return price != null && Number.isFinite(price) && price > 0 ? price : null
}

export function mapGrindhouseMaterial(raw: string): BrandModelVariantMaterial {
  const v = raw.trim().toLowerCase()
  if (!v) return "other"
  if (v.includes("fiberglass") || v.includes("solid")) return "pu_poly"
  if (v.includes("carbon")) return "carbon"
  if (v.includes("honeycomb") || v.includes("epoxy")) return "eps_epoxy"
  return "other"
}

export function mapGrindhouseFinBoxes(productName: string): FinBoxesType {
  const name = productName.trim().toLowerCase()
  if (name.includes("quad")) return "quad"
  if (name.includes("thruster")) return "thruster"
  if (name.includes("twin") || name.includes("keel")) return "twin"
  if (name.includes("single fin") || name.includes("single")) return "single"
  if (name.includes("side bite")) return "thruster"
  return "other"
}

export function mapGrindhouseFinBoxType(productName: string): FinBoxType {
  const name = productName.trim().toLowerCase()
  if (name.includes("single fin") || /\b\d(\.\d)?"\s*single/i.test(name)) return "single"
  if (name.includes("side bite")) return "fcs_ii"
  return "fcs_ii"
}

function mapGrindhouseFinSize(productName: string, sizeLabel: string): FinCatalogVariantSize | null {
  const token = `${productName} ${sizeLabel}`.trim().toLowerCase()
  if (token.includes("xl") || token.includes("x-large")) return "xl"
  if (token.includes("large") || /\blarge\b/.test(sizeLabel.toLowerCase())) return "l"
  if (token.includes("small") || /\bsmall\b/.test(sizeLabel.toLowerCase())) return "s"
  return null
}

type ParsedSizeBlock = {
  label: string
  height: string
  base: string
}

function parseDimensionValue(raw: string): string {
  const t = stripMarkdown(raw)
  if (!t) return ""
  if (/["']/.test(t) || /mm|cm|in/i.test(t)) return t
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}"`
  return t
}

function parseSizeBlocks(description: string): ParsedSizeBlock[] {
  const normalized = description.replace(/\r\n/g, "\n")
  const blocks: ParsedSizeBlock[] = []
  const sectionPattern =
    /(?:^|\n)\s*\*{0,2}(SMALL|LARGE|MEDIUM|XL|X-LARGE|Front Quad|Rear Quad)\*{0,2}\s*(?:\n|$)/gi

  const matches = [...normalized.matchAll(sectionPattern)]
  if (matches.length === 0) return blocks

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const label = stripMarkdown(match[1] ?? "")
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length
    const chunk = normalized.slice(start, end)
    const heightMatch = chunk.match(/\*{0,2}Height:\s*([^*\n]+)\*{0,2}/i)
    const baseMatch = chunk.match(/\*{0,2}Base:\s*([^*\n]+)\*{0,2}/i)
    blocks.push({
      label,
      height: parseDimensionValue(heightMatch?.[1] ?? ""),
      base: parseDimensionValue(baseMatch?.[1] ?? ""),
    })
  }

  return blocks
}

function parseSimpleDimensions(description: string): { height: string; base: string } {
  const heightMatch = description.match(/\*{0,2}Height:\s*([^*\n]+)\*{0,2}/i)
  const baseMatch = description.match(/\*{0,2}Base:\s*([^*\n]+)\*{0,2}/i)
  return {
    height: parseDimensionValue(heightMatch?.[1] ?? ""),
    base: parseDimensionValue(baseMatch?.[1] ?? ""),
  }
}

function joinQuadDimensions(blocks: ParsedSizeBlock[]): { height: string; base: string } {
  const front = blocks.find((b) => /front/i.test(b.label))
  const rear = blocks.find((b) => /rear/i.test(b.label))
  if (!front && !rear) return { height: "", base: "" }

  const heightParts = [front?.height, rear?.height].filter(Boolean)
  const baseParts = [front?.base, rear?.base].filter(Boolean)

  return {
    height: heightParts.length > 1 ? `Front: ${heightParts[0]} / Rear: ${heightParts[1]}` : (heightParts[0] ?? ""),
    base: baseParts.length > 1 ? `Front: ${baseParts[0]} / Rear: ${baseParts[1]}` : (baseParts[0] ?? ""),
  }
}

function buildConfigurationLabel(row: GrindhouseFinJsonRow): string {
  const parts = [row.constructionMaterial.trim()].filter(Boolean)
  const finBoxes = mapGrindhouseFinBoxes(row.productName)
  if (finBoxes === "quad") parts.unshift("Quad")
  if (finBoxes === "thruster") parts.unshift("Thruster")
  if (finBoxes === "twin") parts.unshift("Twin")
  if (finBoxes === "single") parts.unshift("Single")
  return parts.join(" · ")
}

export function buildGrindhouseModelDescription(row: GrindhouseFinJsonRow): string | null {
  const description = row.productDescription.trim()
  return description.length > 0 ? description : null
}

export function buildGrindhouseVariantDrafts(row: GrindhouseFinJsonRow): GrindhouseFinVariantDraft[] {
  const price = parsePrice(row.priceUsd)
  const material = mapGrindhouseMaterial(row.constructionMaterial)
  const fin_boxes = mapGrindhouseFinBoxes(row.productName)
  const fin_box_type = mapGrindhouseFinBoxType(row.productName)
  const configuration_label = buildConfigurationLabel(row)
  const modelImage = resolveGrindhouseModelImage(row.productImage)
  const sizeBlocks = parseSizeBlocks(row.productDescription)

  const sizeVariants = sizeBlocks.filter((b) => /^(small|large|medium|xl|x-large)$/i.test(b.label))
  const quadBlocks = sizeBlocks.filter((b) => /front|rear/i.test(b.label))

  if (sizeVariants.length > 0) {
    return sizeVariants.map((block) => ({
      fin_box_type,
      fin_boxes,
      fin_size: mapGrindhouseFinSize(row.productName, block.label),
      material,
      configuration_label: [configuration_label, block.label].filter(Boolean).join(" · "),
      fin_base_label: block.base,
      fin_height_label: block.height,
      fin_foil_label: "",
      price,
      image_url: modelImage,
    }))
  }

  if (quadBlocks.length > 0) {
    const dims = joinQuadDimensions(quadBlocks)
    return [
      {
        fin_box_type,
        fin_boxes,
        fin_size: mapGrindhouseFinSize(row.productName, row.productName),
        material,
        configuration_label,
        fin_base_label: dims.base,
        fin_height_label: dims.height,
        fin_foil_label: "",
        price,
        image_url: modelImage,
      },
    ]
  }

  const dims = parseSimpleDimensions(row.productDescription)
  return [
    {
      fin_box_type,
      fin_boxes,
      fin_size: mapGrindhouseFinSize(row.productName, row.productName),
      material,
      configuration_label,
      fin_base_label: dims.base,
      fin_height_label: dims.height,
      fin_foil_label: "",
      price,
      image_url: modelImage,
    },
  ]
}
