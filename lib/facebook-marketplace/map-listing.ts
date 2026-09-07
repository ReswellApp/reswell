import { capitalizeWords, formatBoardType, formatCondition } from "@/lib/listing-labels"
import { buildBoardCatalogDimensionLabelsFromListingRow } from "@/lib/utils/listing-board-catalog-snapshot"
import {
  FACEBOOK_MARKETPLACE_CATEGORY,
  FACEBOOK_MARKETPLACE_DESCRIPTION_MAX,
  FACEBOOK_MARKETPLACE_TITLE_MAX,
  type FacebookMarketplaceCategory,
  type FacebookMarketplaceCondition,
} from "@/lib/facebook-marketplace/categories"

export type FacebookMarketplaceListingSource = {
  id: string
  title: string
  description?: string | null
  price: string | number | null
  condition?: string | null
  section?: string | null
  board_type?: string | null
  brand?: string | null
  model?: string | null
  dimensions?: string | null
}

export type FacebookMarketplaceBulkRow = {
  title: string
  price: number
  condition: FacebookMarketplaceCondition
  description: string
  category: FacebookMarketplaceCategory
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function truncatePlainText(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength).trimEnd()
}

export function mapListingConditionToFacebookMarketplace(
  condition: string | null | undefined,
): FacebookMarketplaceCondition {
  const value = (condition ?? "").trim().toLowerCase()
  if (value === "brand_new" || value === "new") return "New"
  if (value === "like_new" || value === "excellent") return "Used - Like New"
  if (value === "very_good" || value === "good") return "Used - Good"
  return "Used - Fair"
}

function boardTypeKey(boardType: string | null | undefined): string {
  return (boardType ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-")
}

export function mapListingSectionToFacebookMarketplaceCategory(
  section: string | null | undefined,
  boardType?: string | null,
): FacebookMarketplaceCategory {
  const type = boardTypeKey(boardType)
  if (type.includes("bodyboard") || type === "boogie") {
    return FACEBOOK_MARKETPLACE_CATEGORY.bodyboards
  }
  if (type.includes("skim")) {
    return FACEBOOK_MARKETPLACE_CATEGORY.skimboards
  }

  switch ((section ?? "").trim()) {
    case "wetsuits":
      return FACEBOOK_MARKETPLACE_CATEGORY.wetsuits
    case "apparel":
      return FACEBOOK_MARKETPLACE_CATEGORY.rashGuards
    case "magazines":
      return FACEBOOK_MARKETPLACE_CATEGORY.magazines
    case "fins":
    case "boardbags":
    case "surfpacks":
    case "leashes":
    case "accessories":
      return FACEBOOK_MARKETPLACE_CATEGORY.surfingAccessories
    case "surfboards":
    default:
      return FACEBOOK_MARKETPLACE_CATEGORY.surfboards
  }
}

function listingPriceWholeDollars(price: string | number | null | undefined): number | null {
  const n = typeof price === "number" ? price : Number.parseFloat(String(price ?? "").replace(/,/g, ""))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function specLines(listing: FacebookMarketplaceListingSource): string[] {
  const lines: string[] = []
  const brand = listing.brand?.trim()
  const model = listing.model?.trim()
  if (brand || model) {
    lines.push(["Brand/model:", brand, model].filter(Boolean).join(" "))
  }

  const boardType = formatBoardType(listing.board_type)
  if (boardType) lines.push(`Board type: ${boardType}.`)

  const dims = buildBoardCatalogDimensionLabelsFromListingRow(listing)
  if (dims.dimensions_summary) lines.push(`Dimensions: ${dims.dimensions_summary}.`)

  const conditionLabel = formatCondition(listing.condition)
  if (conditionLabel) lines.push(`Condition: ${conditionLabel}.`)

  return lines
}

export function buildFacebookMarketplaceDescription(
  listing: FacebookMarketplaceListingSource,
): string {
  const notes = stripHtml(listing.description?.trim() ?? "")
  const specs = specLines(listing)
  const parts = [notes, specs.join(" ")].filter((part) => part.length > 0)
  const fallback = capitalizeWords(listing.title.trim()) || "Surf gear listed on Reswell."
  const text = parts.length > 0 ? parts.join("\n\n") : fallback
  return truncatePlainText(text, FACEBOOK_MARKETPLACE_DESCRIPTION_MAX)
}

export function mapListingToFacebookMarketplaceRow(
  listing: FacebookMarketplaceListingSource,
): FacebookMarketplaceBulkRow | null {
  const price = listingPriceWholeDollars(listing.price)
  if (price == null) return null

  const title = truncatePlainText(
    capitalizeWords(listing.title.trim()) || "Untitled listing",
    FACEBOOK_MARKETPLACE_TITLE_MAX,
  )
  if (!title) return null

  return {
    title,
    price,
    condition: mapListingConditionToFacebookMarketplace(listing.condition),
    description: buildFacebookMarketplaceDescription(listing),
    category: mapListingSectionToFacebookMarketplaceCategory(listing.section, listing.board_type),
  }
}
