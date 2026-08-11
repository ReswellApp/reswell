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

/** Same brand as Firewire surfboards — fin models use product_category_slug = "fins". */
export const FIREWIRE_FINS_BRAND_SLUG = "firewire-surfboards"

export const DEFAULT_FIREWIRE_FIN_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260811_200139.json",
)

export type FirewireFinJsonRow = {
  productName: string
  productUrl: string
  productImages: string
  priceUsd: string
  productDescription: string
  finSystem: string
}

export type FirewireFinVariantDraft = {
  fin_box_type: FinBoxType
  fin_boxes: FinBoxesType
  fin_size: FinCatalogVariantSize | null
  material: BrandModelVariantMaterial
  configuration_label: string
  fin_base_label: string
  fin_height_label: string
  fin_foil_label: string
  fin_color_label: string
  price: number | null
  image_url: string | null
}

export function toFirewireFinJsonRow(raw: Record<string, string>): FirewireFinJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImages: raw["Product Images"]?.trim() || raw["Product Image"]?.trim() || "",
    priceUsd: raw["Regular Price (USD)"]?.trim() || raw["Price (USD)"]?.trim() || "",
    productDescription: raw["Product Description"]?.trim() ?? "",
    finSystem: raw["Fin System"]?.trim() ?? "",
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
export function preferFirewireFinProductImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  if (/[?&]width=\d+/i.test(t)) {
    return t.replace(/([?&]width=)\d+/i, "$11200")
  }
  return t
}

export function resolveFirewireFinModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw).map(preferFirewireFinProductImageUrl)
  return candidates[0] ?? null
}

function pickImageForFinBoxType(rawImages: string, finBoxType: FinBoxType): string | null {
  const urls = splitImageUrls(rawImages).map(preferFirewireFinProductImageUrl)
  if (urls.length === 0) return null

  const prefer =
    finBoxType === "futures"
      ? [/futures/i, /single.?tab/i]
      : finBoxType === "fcs_ii" || finBoxType === "fcs_twin_tab"
        ? [/fcs/i]
        : []

  for (const pattern of prefer) {
    const match = urls.find((u) => pattern.test(u))
    if (match) return match
  }
  return urls[0] ?? null
}

export function isValidFirewireFinJsonRow(row: FirewireFinJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadFirewireFinJsonRows(jsonPath: string): FirewireFinJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toFirewireFinJsonRow).filter(isValidFirewireFinJsonRow)
}

function parsePrice(raw: string): number | null {
  const price = raw ? Number(raw) : null
  return price != null && Number.isFinite(price) && price > 0 ? price : null
}

function mapFinBoxesFromText(text: string): FinBoxesType | null {
  const blob = text.trim().toLowerCase()
  if (!blob) return null
  // Prefer explicit product naming over narrative description keywords.
  if (/\btwin\s*\+\s*2\b/.test(blob) || blob.includes("twin + 2")) return "twin"
  if (blob.includes("5-fin") || blob.includes("five fin") || /\b5\s*fin\b/.test(blob)) {
    return "five"
  }
  if (blob.includes("quad")) return "quad"
  if (blob.includes("twin") || blob.includes("keel")) return "twin"
  if (blob.includes("thruster") || blob.includes("tri-fin") || /\btri\b/.test(blob)) {
    return "thruster"
  }
  if (blob.includes("single fin") || /\bsingle\b/.test(blob)) return "single"
  return null
}

export function mapFirewireFinBoxes(productName: string, description: string): FinBoxesType {
  return (
    mapFinBoxesFromText(productName) ?? mapFinBoxesFromText(description) ?? "other"
  )
}

export function mapFirewireFinBoxTypeFromLabel(raw: string): FinBoxType | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (t.includes("glass")) return "glass_on"
  if (t.includes("single tab") || t.includes("futures")) return "futures"
  if (t.includes("fcs ii") || t.includes("fcs2")) return "fcs_ii"
  if (t.includes("fcs")) return "fcs_ii"
  if (t.includes("single") && t.includes("fin system")) return "single"
  return null
}

function detectFinBoxTypes(row: FirewireFinJsonRow): FinBoxType[] {
  const primary = mapFirewireFinBoxTypeFromLabel(row.finSystem)
  const blob = `${row.productName}\n${row.productDescription}\n${row.productImages}`.toLowerCase()
  const found = new Set<FinBoxType>()

  if (primary) found.add(primary)

  // Image filenames use tokens like KSTwin_FCS_Setups — underscore is a word char, so avoid \b.
  const mentionsFutures = /futures|single[\s_-]?tab/.test(blob)
  const mentionsFcs = /(?:^|[^a-z0-9])fcs(?:[^a-z0-9]|$)/i.test(blob)

  if (mentionsFutures) found.add("futures")
  if (mentionsFcs) found.add("fcs_ii")

  if (found.size === 0) found.add(primary ?? "futures")
  return [...found]
}

function finSystemLabel(finBoxType: FinBoxType): string {
  if (finBoxType === "futures") return "Single Tab (Futures)"
  if (finBoxType === "fcs_ii") return "FCS II"
  if (finBoxType === "fcs_twin_tab") return "FCS Twin Tab"
  if (finBoxType === "single") return "Single Fin"
  return "Other"
}

function mapFinSize(productName: string, description: string): FinCatalogVariantSize | null {
  const blob = `${productName} ${description}`.toLowerCase()
  if (/\b(x-?large|xl)\b/.test(blob)) return "xl"
  if (/\blarge\b|\b\(l\)\b/.test(blob)) return "l"
  if (/\bmedium\b|\b\(m\)\b/.test(blob)) return "m"
  if (/\bsmall\b|\b\(s\)\b/.test(blob)) return "s"
  if (/\b(x-?small|xs|grom)\b/.test(blob)) return "xs"
  return null
}

function setupLabel(productName: string, finBoxes: FinBoxesType): string {
  const name = productName.trim().toLowerCase()
  if (/\btwin\s*\+\s*2\b/.test(name) || name.includes("twin + 2")) return "Twin + 2"
  if (finBoxes === "twin") return "Twin"
  if (finBoxes === "thruster") return "Thruster"
  if (finBoxes === "quad") return "Quad"
  if (finBoxes === "five") return "5-Fin"
  if (finBoxes === "single") return "Single"
  return ""
}

export function buildFirewireFinModelDescription(row: FirewireFinJsonRow): string | null {
  const description = row.productDescription.trim()
  return description.length > 0 ? description : null
}

export function buildFirewireFinVariantDrafts(row: FirewireFinJsonRow): FirewireFinVariantDraft[] {
  const price = parsePrice(row.priceUsd)
  const fin_boxes = mapFirewireFinBoxes(row.productName, row.productDescription)
  const fin_size = mapFinSize(row.productName, row.productDescription)
  const setup = setupLabel(row.productName, fin_boxes)
  const systems = detectFinBoxTypes(row)

  return systems.map((fin_box_type) => {
    const systemLabel = finSystemLabel(fin_box_type)
    return {
      fin_box_type,
      fin_boxes,
      fin_size,
      material: "other" as const,
      configuration_label: [setup, systemLabel].filter(Boolean).join(" · "),
      fin_base_label: "",
      fin_height_label: "",
      fin_foil_label: "",
      fin_color_label: "",
      price,
      image_url: pickImageForFinBoxType(row.productImages, fin_box_type),
    }
  })
}
