import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import {
  extractFirstHttpImageUrl,
  isValidHttpImageSource,
} from "@/lib/services/brandCatalogImageStorage"
import type { BrandModelVariantMaterial } from "@/lib/validations/brand-model-variants"

export const SHARP_EYE_BRAND_SLUG = "sharpeye-surfboards"

export const DEFAULT_SHARP_EYE_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260704_003311.json",
)

const SHARP_EYE_MATERIAL_SUFFIX_RE = /^(E3[- ]?LITE|C1[- ]?LITE)$/i

export type SharpEyeJsonRow = {
  productName: string
  productDescription: string
  productImage: string
}

export type ParsedSharpEyeProductName = {
  baseName: string
  materialLabel: string | null
  material: BrandModelVariantMaterial
}

export type SharpEyeMaterialVariantDraft = {
  materialLabel: string
  material: BrandModelVariantMaterial
  imageUrl: string | null
}

export type GroupedSharpEyeModelDraft = {
  baseName: string
  description: string | null
  modelImageUrl: string | null
  variants: SharpEyeMaterialVariantDraft[]
}

export function toSharpEyeJsonRow(raw: Record<string, string>): SharpEyeJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
  }
}

function normalizeSharpEyeMaterialSuffix(raw: string): string {
  const t = raw.trim().replace(/-/g, " ").replace(/\s+/g, " ").toUpperCase()
  if (/^E3 LITE$/i.test(t)) return "E3 Lite"
  if (/^C1 LITE$/i.test(t)) return "C1 Lite"
  return raw.trim()
}

export function mapSharpEyeMaterialLabel(label: string | null): BrandModelVariantMaterial {
  const t = label?.trim().toUpperCase().replace(/-/g, " ") ?? ""
  if (t === "E3 LITE") return "eps_epoxy"
  if (t === "C1 LITE") return "carbon"
  return "pu_poly"
}

/** Split scrape product names like `INFERNO 72 (E3 LITE)` into base model + material build. */
export function parseSharpEyeProductName(raw: string): ParsedSharpEyeProductName {
  const name = raw.trim()
  const match = name.match(/^(.+?)\s+\(([^)]+)\)$/)
  if (match) {
    const suffix = match[2].trim()
    if (SHARP_EYE_MATERIAL_SUFFIX_RE.test(suffix)) {
      const materialLabel = normalizeSharpEyeMaterialSuffix(suffix)
      return {
        baseName: match[1].trim(),
        materialLabel,
        material: mapSharpEyeMaterialLabel(materialLabel),
      }
    }
  }

  return {
    baseName: name,
    materialLabel: null,
    material: "pu_poly",
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
export function resolveSharpEyeModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw)
  if (candidates.length > 0) return candidates[0]
  return extractFirstHttpImageUrl(raw)
}

export function buildSharpEyeModelDescription(row: SharpEyeJsonRow): string | null {
  const description = row.productDescription.trim()
  return description || null
}

export function isValidSharpEyeJsonRow(row: SharpEyeJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadSharpEyeJsonRows(jsonPath: string): SharpEyeJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toSharpEyeJsonRow).filter(isValidSharpEyeJsonRow)
}

function variantMaterialKey(material: BrandModelVariantMaterial, materialLabel: string): string {
  return `${material}:${materialLabel.trim().toLowerCase()}`
}

/** Group scrape rows into one catalog model with material variants underneath. */
export function groupSharpEyeJsonRows(rows: SharpEyeJsonRow[]): GroupedSharpEyeModelDraft[] {
  const groups = new Map<
    string,
    {
      baseName: string
      description: string | null
      variants: Map<string, SharpEyeMaterialVariantDraft>
    }
  >()

  for (const row of rows) {
    const parsed = parseSharpEyeProductName(row.productName)
    const key = parsed.baseName.toLowerCase()
    let group = groups.get(key)
    if (!group) {
      group = {
        baseName: parsed.baseName,
        description: null,
        variants: new Map(),
      }
      groups.set(key, group)
    }

    if (!parsed.materialLabel) {
      group.baseName = parsed.baseName
    }

    const description = buildSharpEyeModelDescription(row)
    if (description) {
      group.description = description
    }

    const materialLabel = parsed.materialLabel ?? "PU/PE"
    const variantKey = variantMaterialKey(parsed.material, materialLabel)
    group.variants.set(variantKey, {
      materialLabel,
      material: parsed.material,
      imageUrl: resolveSharpEyeModelImage(row.productImage),
    })
  }

  return [...groups.values()].map((group) => {
    const variants = [...group.variants.values()]
    const standard =
      variants.find((v) => v.material === "pu_poly" && v.materialLabel === "PU/PE") ??
      variants[0] ??
      null

    return {
      baseName: group.baseName,
      description: group.description,
      modelImageUrl: standard?.imageUrl ?? null,
      variants,
    }
  })
}
