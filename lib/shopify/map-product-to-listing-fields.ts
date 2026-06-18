import { finSizeSlugForDb, finSystemSlugForDb } from "@/lib/fin-listing-config"
import { finsSetupFieldForDb } from "@/lib/listing-facet-write"
import { wetsuitSizeSlugForDb } from "@/lib/wetsuit-listing-config"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { parseReswellTags, resolveShopifyProductSection } from "@/lib/shopify/map-product-to-section"
import {
  isPeerListingSectionValue,
  shopifySectionRegistryEntry,
} from "@/lib/shopify/section-registry"
import type {
  ShopifyMappedVariant,
  ShopifyRestProduct,
  ShopifyRestVariant,
  ShopifySectionMappingRow,
} from "@/lib/shopify/types"

function stripHtml(html: string | null | undefined): string {
  if (!html?.trim()) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function normalizeSizeSlug(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  return raw.trim().toLowerCase().replace(/\s+/g, "-")
}

function variantOptionValues(variant: ShopifyRestVariant): string[] {
  return [variant.option1, variant.option2, variant.option3]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
}

function buildVariantTitle(product: ShopifyRestProduct, variant: ShopifyRestVariant): string {
  const base = product.title.trim()
  const variantTitle = variant.title.trim()
  if (!variantTitle || variantTitle.toLowerCase() === "default title") {
    return base.slice(0, 60)
  }
  const combined = `${base} — ${variantTitle}`
  return combined.slice(0, 60)
}

function buildFacetFields(
  section: PeerListingSection,
  product: ShopifyRestProduct,
  variant: ShopifyRestVariant,
): Record<string, string | null> {
  const reswellTags = parseReswellTags(product.tags ?? "")
  const options = variantOptionValues(variant)
  const sizeRaw = reswellTags.size ?? options[0] ?? null

  const fields: Record<string, string | null> = {}

  const entry = shopifySectionRegistryEntry(section)
  if (entry.sizeColumn) {
    fields[entry.sizeColumn] = normalizeSizeSlug(sizeRaw)
  }

  if (section === "fins") {
    fields.fins_setup = finsSetupFieldForDb(reswellTags.setup ?? undefined) ?? null
    fields.fin_system = finSystemSlugForDb(reswellTags.system ?? null)
    const finSize = finSizeSlugForDb(sizeRaw)
    if (finSize) fields.fin_size = finSize
  }

  if (section === "wetsuits") {
    const wetsuitSize = wetsuitSizeSlugForDb(sizeRaw)
    if (wetsuitSize) fields.wetsuit_size = wetsuitSize
  }

  return fields
}

export function mapShopifyVariantToListing(opts: {
  product: ShopifyRestProduct
  variant: ShopifyRestVariant
  mappings: ShopifySectionMappingRow[]
  collectionTitles?: string[]
  /** Override auto-detected section (manual import). */
  sectionOverride?: PeerListingSection | null
}): ShopifyMappedVariant | null {
  const section =
    opts.sectionOverride ??
    resolveShopifyProductSection({
      product: opts.product,
      mappings: opts.mappings,
      collectionTitles: opts.collectionTitles,
    })

  if (!section || !isPeerListingSectionValue(section)) {
    return null
  }

  const price = parseFloat(opts.variant.price)
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }

  const description = stripHtml(opts.product.body_html)
  const imageUrls = [...(opts.product.images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((img) => img.src)
    .filter(Boolean)

  const vendor = opts.product.vendor?.trim() || null
  const model =
    opts.variant.title.trim().toLowerCase() === "default title"
      ? null
      : opts.variant.title.trim() || null

  return {
    product: opts.product,
    variant: opts.variant,
    section,
    title: buildVariantTitle(opts.product, opts.variant),
    description: description || opts.product.title.trim(),
    price,
    condition: "brand_new",
    brand: vendor,
    model,
    imageUrls,
    facetFields: buildFacetFields(section, opts.product, opts.variant),
  }
}

export function shopifyVariantInStock(variant: ShopifyRestVariant): boolean {
  return (variant.inventory_quantity ?? 0) > 0
}

export interface MappedShopifyVariantUnit {
  shopifyVariantId: string
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  sku: string | null
  price: number
  stockQuantity: number
  inStock: boolean
  position: number
}

export interface MappedShopifyProduct {
  section: PeerListingSection
  title: string
  description: string
  /** Lowest sellable variant price — the listing-level display price. */
  price: number
  brand: string | null
  imageUrls: string[]
  facetFields: Record<string, string | null>
  hasVariants: boolean
  variants: MappedShopifyVariantUnit[]
}

/**
 * Product-level mapping: one Reswell listing per Shopify product, with each Shopify variant
 * becoming a purchasable variant unit. Returns null when the product can't map to a peer section
 * or has no sellable (priced) variant.
 */
export function mapShopifyProductToListing(opts: {
  product: ShopifyRestProduct
  mappings: ShopifySectionMappingRow[]
  collectionTitles?: string[]
  sectionOverride?: PeerListingSection | null
}): MappedShopifyProduct | null {
  const section =
    opts.sectionOverride ??
    resolveShopifyProductSection({
      product: opts.product,
      mappings: opts.mappings,
      collectionTitles: opts.collectionTitles,
    })

  if (!section || !isPeerListingSectionValue(section)) return null

  const sellable = (opts.product.variants ?? [])
    .map((variant, index) => {
      const price = parseFloat(variant.price)
      if (!Number.isFinite(price) || price <= 0) return null
      const options = variantOptionValues(variant)
      const stock = Math.max(0, variant.inventory_quantity ?? 0)
      return {
        shopifyVariantId: String(variant.id),
        title:
          variant.title.trim() && variant.title.trim().toLowerCase() !== "default title"
            ? variant.title.trim()
            : opts.product.title.trim(),
        option1: variant.option1?.trim() || null,
        option2: variant.option2?.trim() || null,
        option3: variant.option3?.trim() || null,
        sku: variant.sku?.trim() || null,
        price,
        stockQuantity: stock,
        inStock: stock > 0,
        position: index,
      } satisfies MappedShopifyVariantUnit
    })
    .filter((v): v is MappedShopifyVariantUnit => v !== null)

  if (sellable.length === 0) return null

  const description = stripHtml(opts.product.body_html)
  const imageUrls = [...(opts.product.images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((img) => img.src)
    .filter(Boolean)

  const firstVariant = opts.product.variants?.[0]
  const facetFields = firstVariant
    ? buildFacetFields(section, opts.product, firstVariant)
    : {}

  const isMultiVariant =
    sellable.length > 1 ||
    sellable.some((v) => v.title.toLowerCase() !== opts.product.title.trim().toLowerCase())

  return {
    section,
    title: opts.product.title.trim().slice(0, 120),
    description: description || opts.product.title.trim(),
    price: Math.min(...sellable.map((v) => v.price)),
    brand: opts.product.vendor?.trim() || null,
    imageUrls,
    facetFields,
    hasVariants: isMultiVariant,
    variants: sellable,
  }
}

export { stripHtml }
