import { isPeerListingSection, PEER_LISTING_SECTIONS, type PeerListingSection } from "@/lib/peer-listing-sections"
import { isShopifyManagedListing } from "@/lib/shopify/listing"

/** Product types an admin promo can be limited to. Matches marketplace listing sections. */
export const ADMIN_PROMO_PRODUCT_TYPE_OPTIONS: readonly {
  section: PeerListingSection
  label: string
}[] = [
  { section: "surfboards", label: "Surfboards" },
  { section: "fins", label: "Fins" },
  { section: "wetsuits", label: "Wetsuits" },
  { section: "boardbags", label: "Boardbags" },
  { section: "surfpacks", label: "Surfpacks" },
  { section: "leashes", label: "Leashes" },
  { section: "apparel", label: "Apparel" },
  { section: "accessories", label: "Accessories" },
  { section: "magazines", label: "Magazines" },
  { section: "traction", label: "Traction" },
]

const LABEL_BY_SECTION = Object.fromEntries(
  ADMIN_PROMO_PRODUCT_TYPE_OPTIONS.map((option) => [option.section, option.label]),
) as Record<PeerListingSection, string>

const BUYER_PHRASE_BY_SECTION: Record<PeerListingSection, string> = {
  surfboards: "surfboards",
  fins: "fins",
  wetsuits: "wetsuits",
  boardbags: "boardbags",
  surfpacks: "surfpacks",
  leashes: "leashes",
  apparel: "apparel",
  accessories: "accessories",
  magazines: "magazines",
  traction: "traction",
}

export type PromoCheckoutLine = {
  listingId: string
  section: string | null
  unitPriceUsd: number
  quantity: number
  inventorySource?: string | null
  /** Resolved product type. Peer `section` wins; Shopify mappings fill shop lines. */
  productType?: PeerListingSection | null
}

/** Null means the code discounts every product type. */
export function normalizeAdminPromoEligibleSections(
  raw: readonly string[] | null | undefined,
): PeerListingSection[] | null {
  if (!raw || raw.length === 0) return null
  const picked = new Set<PeerListingSection>()
  for (const value of raw) {
    const section = value.trim()
    if (isPeerListingSection(section)) picked.add(section)
  }
  const normalized = PEER_LISTING_SECTIONS.filter((section) => picked.has(section))
  return normalized.length > 0 ? normalized : null
}

export function adminPromoProductTypeLabel(
  sections: readonly string[] | null | undefined,
): string {
  const normalized = normalizeAdminPromoEligibleSections(sections)
  if (!normalized) return "All products"
  return normalized.map((section) => LABEL_BY_SECTION[section]).join(", ")
}

/** Buyer-facing scope: "items", "fins", or "fins and surfboards". */
export function promoDiscountScopePhrase(
  sections: readonly string[] | null | undefined,
): string {
  const normalized = normalizeAdminPromoEligibleSections(sections)
  if (!normalized) return "items"
  const names = normalized.map((section) => BUYER_PHRASE_BY_SECTION[section])
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

export function promoProductTypeRestrictionError(sections: readonly string[]): string {
  return `This code only works on ${promoDiscountScopePhrase(sections)}.`
}

/**
 * Peer listings use `listings.section`. Shop and Shopify rows use section `new`,
 * so their type comes from the Shopify product mapping when one exists.
 */
export function promoProductTypeForListing(input: {
  section: string | null | undefined
  shopifyReswellSection?: string | null
}): PeerListingSection | null {
  if (isPeerListingSection(input.section)) return input.section
  if (input.shopifyReswellSection && isPeerListingSection(input.shopifyReswellSection)) {
    return input.shopifyReswellSection
  }
  return null
}

export function promoPreviewQuantity(input: {
  section: string | null
  inventorySource?: string | null
  requested: number
  stockQuantity?: number | null
}): number {
  if (isShopifyManagedListing({ inventory_source: input.inventorySource })) return 1
  const requested = Math.max(1, Math.floor(input.requested))
  if (isPeerListingSection(input.section)) return requested
  const stock = Math.max(0, Math.floor(Number(input.stockQuantity) || 0))
  if (stock > 0) return Math.min(requested, stock)
  return requested
}

function lineExtensionUsd(line: PromoCheckoutLine): number {
  const qty = Math.max(0, Math.floor(line.quantity))
  const unit = Number(line.unitPriceUsd)
  if (qty < 1 || !Number.isFinite(unit) || unit < 0) return 0
  return unit * qty
}

export function sumPromoLineSubtotalUsd(lines: readonly PromoCheckoutLine[]): number {
  const sum = lines.reduce((total, line) => total + lineExtensionUsd(line), 0)
  return Math.round(sum * 100) / 100
}

/** Unrestricted codes count every line. Restricted codes count matching product types only. */
export function eligiblePromoItemSubtotalUsd(
  lines: readonly PromoCheckoutLine[],
  eligibleSections: readonly string[] | null | undefined,
): number {
  const allowed = normalizeAdminPromoEligibleSections(eligibleSections)
  if (!allowed) return sumPromoLineSubtotalUsd(lines)
  const allowedSet = new Set<string>(allowed)
  const sum = lines.reduce((total, line) => {
    const productType =
      line.productType ?? promoProductTypeForListing({ section: line.section })
    if (!productType || !allowedSet.has(productType)) return total
    return total + lineExtensionUsd(line)
  }, 0)
  return Math.round(sum * 100) / 100
}

/**
 * Discount is a percent of the eligible item subtotal. Ineligible items stay at full price.
 * Shipping is never discounted.
 */
export function computeRestrictedPromoCheckoutAmounts(params: {
  itemSubtotalUsd: number
  eligibleItemSubtotalUsd: number
  shippingUsd: number
  discountPercent: number
}): { discountUsd: number; totalUsd: number } {
  const discountUsd =
    Math.round(Math.max(0, params.eligibleItemSubtotalUsd) * params.discountPercent) / 100
  const totalUsd =
    Math.round(
      (Math.max(0, params.itemSubtotalUsd) - discountUsd + Math.max(0, params.shippingUsd)) * 100,
    ) / 100
  return { discountUsd, totalUsd }
}

export function promoCheckoutLinesFromPricedListings(params: {
  listings: readonly {
    id: string
    section: string | null
    inventory_source?: string | null
  }[]
  pricedLines: readonly { listingId: string; itemPrice: number; quantity: number }[]
}): PromoCheckoutLine[] {
  const byId = new Map(params.listings.map((listing) => [listing.id, listing]))
  return params.pricedLines.map((line) => {
    const listing = byId.get(line.listingId)
    return {
      listingId: line.listingId,
      section: listing?.section ?? null,
      unitPriceUsd: line.itemPrice,
      quantity: line.quantity,
      inventorySource: listing?.inventory_source ?? null,
    }
  })
}
