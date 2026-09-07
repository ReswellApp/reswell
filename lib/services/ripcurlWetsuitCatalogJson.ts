import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { isValidHttpImageSource } from "@/lib/services/brandCatalogImageStorage"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"

export const RIPCURL_BRAND_SLUG = "ripcurl"
export const RIPCURL_BRAND_NAME = "Ripcurl"
export const RIPCURL_WEBSITE_URL = "https://www.ripcurl.com"

export const WETSUIT_CATALOG_PRODUCT_CATEGORY = "wetsuits" satisfies BrandProductCategorySlug

export const DEFAULT_RIPCURL_JSON = resolve(
  homedir(),
  "Downloads/Thunderbit_0b8b19_20260811_204024.json",
)

export type RipcurlWetsuitJsonRow = {
  productName: string
  productUrl: string
  productImages: string
  priceUsd: string
  colors: string
  availableSizes: string
  productDetails: string
  thicknessMm: string
  temperatureRangeF: string
  zipType: string
  productId: string
}

export type RipcurlWetsuitVariantDraft = {
  configuration_label: string
  fin_color_label: string
  price: number | null
  image_url: string | null
}

export type RipcurlWetsuitModelDraft = {
  productName: string
  description: string | null
  image_url: string | null
  variants: RipcurlWetsuitVariantDraft[]
}

export function toRipcurlWetsuitJsonRow(raw: Record<string, string>): RipcurlWetsuitJsonRow {
  return {
    productName: raw["Product Name"]?.trim() ?? "",
    productUrl: raw["Product URL"]?.trim() ?? "",
    productImages: raw["Product Image"]?.trim() || raw["Product Images"]?.trim() || "",
    priceUsd: raw["Original Price (USD)"]?.trim() || raw["Price (USD)"]?.trim() || "",
    colors: raw["Color"]?.trim() ?? "",
    availableSizes: raw["Available Sizes"]?.trim() ?? "",
    productDetails: raw["Product Details"]?.trim() ?? "",
    thicknessMm: raw["Thickness (mm)"]?.trim() ?? "",
    temperatureRangeF: raw["Temperature Range (Fahrenheit)"]?.trim() ?? "",
    zipType: raw["Zip Type"]?.trim() ?? "",
    productId: raw["Product ID"]?.trim() ?? "",
  }
}

function splitMultilineList(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
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

/** Prefer larger Shopify CDN images when a width query param is present. */
export function preferRipcurlProductImageUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  if (/[?&]width=\d+/i.test(t)) {
    return t.replace(/([?&]width=)\d+/i, "$11200")
  }
  return t
}

export function resolveRipcurlModelImage(raw: string): string | null {
  const candidates = splitImageUrls(raw).map(preferRipcurlProductImageUrl)
  return candidates[0] ?? null
}

export function isValidRipcurlWetsuitJsonRow(row: RipcurlWetsuitJsonRow): boolean {
  return row.productName.trim().length > 0
}

export function loadRipcurlWetsuitJsonRows(jsonPath: string): RipcurlWetsuitJsonRow[] {
  const raw = readFileSync(jsonPath, "utf8")
  const parsed = JSON.parse(raw) as Record<string, string>[]
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of product rows")
  }
  return parsed.map(toRipcurlWetsuitJsonRow).filter(isValidRipcurlWetsuitJsonRow)
}

function parsePrice(raw: string): number | null {
  const price = raw ? Number(raw.replace(/[^0-9.]/g, "")) : null
  return price != null && Number.isFinite(price) && price > 0 ? price : null
}

/** Primary colorway for a scraped product page — first Color value. */
export function primaryColorFromRow(row: RipcurlWetsuitJsonRow): string {
  const colors = splitMultilineList(row.colors)
  return colors[0] ?? ""
}

export function buildRipcurlWetsuitModelDescription(row: RipcurlWetsuitJsonRow): string | null {
  const meta: string[] = []
  if (row.thicknessMm) meta.push(`Thickness: ${row.thicknessMm}`)
  if (row.zipType) meta.push(`Zip: ${row.zipType}`)
  if (row.temperatureRangeF) meta.push(`Temperature range: ${row.temperatureRangeF}`)

  const parts = [row.productDetails.trim(), meta.length > 0 ? meta.join(" · ") : ""]
    .map((s) => s.trim())
    .filter(Boolean)

  return parts.length > 0 ? parts.join("\n\n") : null
}

function variantKey(size: string, color: string): string {
  return `${size.trim().toLowerCase()}|${color.trim().toLowerCase()}`
}

/**
 * Collapse Thunderbit colorway rows into one catalog model per product name.
 * Variants are size × primary colorway (not the full Color list on each page).
 */
export function buildRipcurlWetsuitModelDrafts(
  rows: RipcurlWetsuitJsonRow[],
): RipcurlWetsuitModelDraft[] {
  const byName = new Map<
    string,
    {
      productName: string
      description: string | null
      image_url: string | null
      variantsByKey: Map<string, RipcurlWetsuitVariantDraft>
    }
  >()

  for (const row of rows) {
    const name = row.productName.trim()
    if (!name) continue

    const key = name.toLowerCase()
    let bucket = byName.get(key)
    if (!bucket) {
      bucket = {
        productName: name,
        description: buildRipcurlWetsuitModelDescription(row),
        image_url: resolveRipcurlModelImage(row.productImages),
        variantsByKey: new Map(),
      }
      byName.set(key, bucket)
    } else {
      if (!bucket.description) {
        bucket.description = buildRipcurlWetsuitModelDescription(row)
      }
      if (!bucket.image_url) {
        bucket.image_url = resolveRipcurlModelImage(row.productImages)
      }
    }

    const color = primaryColorFromRow(row)
    const price = parsePrice(row.priceUsd)
    const image_url = resolveRipcurlModelImage(row.productImages)
    const sizes = splitMultilineList(row.availableSizes)

    // Colorway with no listed sizes still gets one catalog row.
    const sizeLabels = sizes.length > 0 ? sizes : [""]

    for (const size of sizeLabels) {
      const vk = variantKey(size, color)
      if (bucket.variantsByKey.has(vk)) continue
      bucket.variantsByKey.set(vk, {
        configuration_label: size,
        fin_color_label: color,
        price,
        image_url,
      })
    }
  }

  return [...byName.values()].map((b) => ({
    productName: b.productName,
    description: b.description,
    image_url: b.image_url,
    variants: [...b.variantsByKey.values()],
  }))
}
