/**
 * Bulk import True Ames fin catalog from Thunderbit CSV export.
 * Remote product images are mirrored into Supabase `brand-assets` (never stored as CDN URLs).
 *
 * Usage:
 *   npx tsx scripts/import-true-ames-fins-catalog.ts [--dry-run] [csv-path]
 *
 * Default csv-path: ~/Downloads/Thunderbit_0b8b19_20260625_225230.csv
 */
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel } from "@/lib/db/brand-models"
import { insertBrandModelVariant, maxSortOrderForBrandModel } from "@/lib/db/brand-model-variants"
import {
  createBrandCatalogImageMirrorCache,
  isExternalBrandCatalogImageUrl,
  isValidHttpImageSource,
  type BrandCatalogImageKind,
} from "@/lib/services/brandCatalogImageStorage"
import { preferFullProductImageUrl } from "@/lib/services/trueAmesFinCatalogCsv"
import type { FinBoxesType, FinBoxType } from "@/lib/validations/brand-model-variants"

const TRUE_AMES_BRAND_ID = "045c41b8-ea77-4f98-8cb2-833a10b722ed"
const DEFAULT_CSV = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260625_225230.csv",
)

type CsvRow = {
  productName: string
  productUrl: string
  productImage: string
  priceUsd: string
  finCompatibility: string
  finType: string
  boardType: string
  productDescription: string
  availableSizes: string
  availableColors: string
  specifications: string
  materialsFitment: string
  productImageVariants: string
}

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional env file
  }
}

/** Minimal RFC 4180 CSV parser for quoted fields. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field)
      field = ""
      if (row.some((c) => c.length > 0)) rows.push(row)
      row = []
      if (ch === "\r") i++
    } else if (ch !== "\r") {
      field += ch
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.length > 0)) rows.push(row)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ""
    })
    return obj
  })
}

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapFinBoxType(raw: string): FinBoxType {
  const v = raw.trim().toLowerCase()
  if (v === "futures") return "futures"
  if (v === "fcs") return "fcs_ii"
  if (v === "single fin" || v === "single") return "single"
  if (v === "glass on" || v === "glass_on") return "glass_on"
  if (v.includes("2+1") && v.includes("futures")) return "two_plus_one_futures"
  if (v.includes("2+1") && v.includes("fcs")) return "two_plus_one_fcs"
  return "other"
}

function mapFinBoxes(finTypeRaw: string, productName: string): FinBoxesType {
  const t = finTypeRaw.trim().toLowerCase()
  const name = productName.toLowerCase()

  if (t.includes("quad") || name.includes("quad")) return "quad"
  if (t.includes("tri") || t.includes("thruster")) return "thruster"
  if (
    t.includes("twin") ||
    t.includes("keel") ||
    t.includes("upright twin") ||
    t.includes("hybrid twin")
  ) {
    return "twin"
  }
  if (t.includes("side bite") || t.includes("side bites")) return "thruster"
  if (t.includes("single") || name.includes("single fin")) return "single"
  if (t.includes("bonzer")) return "other"
  if (t.includes("five") || t.includes("5-fin")) return "five"
  return "other"
}

function parseFinSystems(raw: string, productName: string): FinBoxType[] {
  const parts = splitLines(raw)
  const mapped = parts.map(mapFinBoxType).filter(Boolean)
  const unique = [...new Set(mapped)]
  if (unique.length > 0) return unique

  const name = productName.toLowerCase()
  if (name.includes("futures compatible")) return ["futures"]
  if (name.includes("fcs compatible")) return ["fcs_ii"]
  if (name.includes("glass on")) return ["glass_on"]
  return ["other"]
}

function parseGeometry(specs: string): {
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
} {
  const heightMatch = specs.match(/HEIGHT:\s*([^/\n]+)/i)
  const baseMatch = specs.match(/BASE:\s*([^/\n]+)/i)
  const foilMatch = specs.match(/FOIL:\s*([^\n]+)/i)
  return {
    fin_height_label: heightMatch?.[1]?.trim() ?? "",
    fin_base_label: baseMatch?.[1]?.trim() ?? "",
    fin_foil_label: foilMatch?.[1]?.trim() ?? "",
  }
}

function formatSizeLabel(size: string): string {
  const t = size.trim()
  if (!t) return ""
  if (/["']/.test(t) || /mm|cm|in/i.test(t)) return t
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}"`
  return t
}

function parseImageVariants(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      }
    } catch {
      // fall through
    }
  }
  return splitLines(t)
}

function pickImageForColor(
  fallback: string,
  color: string,
  variantUrls: string[],
): string {
  if (!color.trim()) return fallback
  const colorKey = color.trim().toLowerCase()
  const aliases: Record<string, string[]> = {
    smoke: ["smk", "smoke"],
    clear: ["clr", "clear"],
    red: ["red"],
    blue: ["blu", "blue"],
    green: ["grn", "green"],
    yellow: ["yel", "yellow"],
    orange: ["org", "orange"],
    black: ["blk", "black"],
    white: ["wht", "white"],
    volcanic: ["vol", "volcanic"],
    sand: ["sand"],
    cream: ["cream", "crm"],
  }
  const needles = aliases[colorKey] ?? [colorKey]
  for (const url of variantUrls) {
    const lower = url.toLowerCase()
    if (needles.some((n) => lower.includes(n))) return url
  }
  return fallback
}

function toCsvRow(raw: Record<string, string>): CsvRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImage: raw["Product Image"]?.trim() ?? "",
    priceUsd: raw["Price (USD)"]?.trim() ?? "",
    finCompatibility: raw["Fin Compatibility"]?.trim() ?? "",
    finType: raw["Fin Type"]?.trim() ?? "",
    boardType: raw["Board Type"]?.trim() ?? "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    availableSizes: raw["Available Sizes"]?.trim() ?? "",
    availableColors: raw["Available Colors"]?.trim() ?? "",
    specifications: raw["Specifications"]?.trim() ?? "",
    materialsFitment: raw["Materials & Fitment"]?.trim() ?? "",
    productImageVariants: raw["Product Image Variants"]?.trim() ?? "",
  }
}

type VariantDraft = {
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  fin_color_label: string
  price: number | null
  image_url: string | null
}

function buildVariantDrafts(row: CsvRow): VariantDraft[] {
  const price = row.priceUsd ? Number(row.priceUsd) : null
  const safePrice = price != null && Number.isFinite(price) && price > 0 ? price : null
  const geometry = parseGeometry(row.specifications)
  const finSystems = parseFinSystems(row.finCompatibility, row.productName)
  const finBoxes = mapFinBoxes(row.finType, row.productName)
  const configurationParts = splitLines(row.finType)
  const configurationLabel = configurationParts.join(", ")
  const sizes = splitLines(row.availableSizes)
  const colors = splitLines(row.availableColors)
  const variantImages = parseImageVariants(row.productImageVariants)
  const fallbackImage = row.productImage || null

  const sizeOptions = sizes.length > 0 ? sizes : [""]
  const colorOptions = colors.length > 0 ? colors : [""]

  const drafts: VariantDraft[] = []
  for (const system of finSystems) {
    for (const size of sizeOptions) {
      for (const color of colorOptions) {
        const sizeLabel = formatSizeLabel(size)
        drafts.push({
          fin_box_type: system,
          fin_boxes: finBoxes,
          configuration_label: configurationLabel,
          fin_base_label: sizeLabel ? "" : geometry.fin_base_label,
          fin_height_label: sizeLabel || geometry.fin_height_label,
          fin_foil_label: geometry.fin_foil_label,
          fin_color_label: color,
          price: safePrice,
          image_url: pickImageForColor(fallbackImage ?? "", color, variantImages) || fallbackImage,
        })
      }
    }
  }
  return drafts
}

async function resolveMirroredImageUrl(
  cache: ReturnType<typeof createBrandCatalogImageMirrorCache>,
  supabase: SupabaseClient,
  supabaseUrl: string,
  sourceUrl: string | null,
  kind: BrandCatalogImageKind,
): Promise<string | null> {
  const trimmed = preferFullProductImageUrl(sourceUrl?.trim() ?? "")
  if (!trimmed) return null
  if (!isValidHttpImageSource(trimmed)) return null
  if (!isExternalBrandCatalogImageUrl(trimmed)) return trimmed

  const result = await cache.mirror({ supabase, supabaseUrl, sourceUrl: trimmed, kind })
  if (!result.ok) {
    console.warn(`[import true ames] image mirror failed (${kind}): ${result.error}`)
    return null
  }
  return result.publicUrl
}

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  csvPath: string,
  dryRun: boolean,
): Promise<void> {
  const csvText = readFileSync(csvPath, "utf8")
  const parsed = parseCsv(csvText).map(toCsvRow).filter((r) => r.productName.length > 0)

  console.log(
    JSON.stringify(
      {
        brandId: TRUE_AMES_BRAND_ID,
        csvPath,
        dryRun,
        productCount: parsed.length,
        estimatedVariants: parsed.reduce((n, r) => n + buildVariantDrafts(r).length, 0),
      },
      null,
      2,
    ),
  )

  let modelsCreated = 0
  let variantsCreated = 0
  let skippedModels = 0
  let skippedVariants = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const row of parsed) {
    const descriptionParts = [row.productDescription, row.materialsFitment, row.boardType]
      .map((s) => s.trim())
      .filter(Boolean)
    const description = descriptionParts.length > 0 ? descriptionParts.join("\n\n") : null

    if (dryRun) {
      modelsCreated++
      variantsCreated += buildVariantDrafts(row).length
      continue
    }

    const modelImageUrl = await resolveMirroredImageUrl(
      imageCache,
      supabase,
      supabaseUrl,
      row.productImage || null,
      "model",
    )

    const modelResult = await insertBrandModel(supabase, {
      brand_id: TRUE_AMES_BRAND_ID,
      name: row.productName,
      description,
      image_url: modelImageUrl,
      product_category_slug: "fins",
    })

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        skippedModels++
        errors.push(`Model exists, skipped: ${row.productName}`)
        continue
      }
      errors.push(`Model failed (${row.productName}): ${modelResult.error}`)
      continue
    }

    modelsCreated++
    const modelId = modelResult.row.id
    let sortOrder = await maxSortOrderForBrandModel(supabase, modelId)

    for (const variant of buildVariantDrafts(row)) {
      sortOrder += 1
      const variantImageUrl = await resolveMirroredImageUrl(
        imageCache,
        supabase,
        supabaseUrl,
        variant.image_url,
        "variant",
      )
      const variantResult = await insertBrandModelVariant(supabase, {
        brand_id: TRUE_AMES_BRAND_ID,
        brand_model_id: modelId,
        length_label: "",
        width_label: "",
        thickness_label: "",
        volume_label: "",
        fin_box_type: variant.fin_box_type,
        fin_boxes: variant.fin_boxes,
        material: "other",
        condition: "brand_new",
        configuration_label: variant.configuration_label,
        fin_base_label: variant.fin_base_label,
        fin_height_label: variant.fin_height_label,
        fin_foil_label: variant.fin_foil_label,
        fin_color_label: variant.fin_color_label,
        product_category_slug: "fins",
        price: variant.price,
        image_url: variantImageUrl,
        sort_order: sortOrder,
      })

      if (!variantResult.ok) {
        if (variantResult.code === "23505") {
          skippedVariants++
          continue
        }
        errors.push(
          `Variant failed (${row.productName} / ${variant.fin_color_label || "default"}): ${variantResult.error}`,
        )
        continue
      }
      variantsCreated++
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        modelsCreated,
        variantsCreated,
        skippedModels,
        skippedVariants,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      },
      null,
      2,
    ),
  )
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const csvArg = args.find((a) => !a.startsWith("--"))
  const csvPath = csvArg ? resolve(csvArg) : DEFAULT_CSV

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)
  await importCatalog(supabase, url, csvPath, dryRun)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
