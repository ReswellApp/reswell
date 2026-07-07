import { boardsBrowseBoardTypeLabel } from "@/lib/marketplace-slug-metadata"
import { formatCondition, capitalizeWords } from "@/lib/listing-labels"
import { finSetupLabel, finSystemLabel, finSizeLabel } from "@/lib/fin-listing-config"
import { boardFulfillmentDetailLabels } from "@/lib/listing-fulfillment"
import { buildBoardCatalogDimensionLabelsFromListingRow } from "@/lib/utils/listing-board-catalog-snapshot"
import { mapListingConditionToGoogleMerchant } from "@/lib/google-merchant/condition"

/** Google recommends ~500–1,000 characters; hard cap is 5,000. */
export const GOOGLE_MERCHANT_MIN_DESCRIPTION_LENGTH = 500
export const GOOGLE_MERCHANT_MAX_DESCRIPTION_LENGTH = 5000

export type GoogleMerchantListingDescriptionInput = {
  title: string
  description?: string | null
  price: number
  condition?: string | null
  brand?: string | null
  model?: string | null
  section: string
  board_type?: string | null
  dimensions?: string | null
  fins_setup?: string | null
  fin_system?: string | null
  fin_size?: string | null
  magazine_year?: number | null
  city?: string | null
  state?: string | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  shipping_price?: string | number | null
  board_shipping_cost_mode?: string | null
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function ensureEndsWithPunctuation(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (/[.!?…]["']?$/.test(trimmed)) return trimmed
  return `${trimmed}.`
}

function truncateDescription(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const slice = text.slice(0, maxLength - 1).trimEnd()
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  )
  if (lastSentence > maxLength * 0.6) {
    return ensureEndsWithPunctuation(slice.slice(0, lastSentence + 1))
  }
  return ensureEndsWithPunctuation(slice)
}

function formatUsd(price: number): string {
  return `$${price.toFixed(price % 1 === 0 ? 0 : 2)}`
}

function locationPhrase(city?: string | null, state?: string | null): string | null {
  const c = city?.trim()
  const s = state?.trim()
  if (c && s) return `${c}, ${s}`
  return c || s || null
}

function productCategoryLabel(section: string): string {
  if (section === "fins") return "surfboard fins"
  if (section === "magazines") return "surf magazine"
  return "surfboard"
}

function conditionPhrase(condition: string | null | undefined): string | null {
  const label = formatCondition(condition)
  if (!label) return null
  const merchant = mapListingConditionToGoogleMerchant(condition)
  if (merchant === "NEW") return `Condition: ${label} (new, unopened).`
  if (merchant === "REFURBISHED") return `Condition: ${label} (professionally refurbished).`
  return `Condition: ${label} (pre-owned).`
}

function surfboardSpecSentences(listing: GoogleMerchantListingDescriptionInput): string[] {
  const sentences: string[] = []
  const dims = buildBoardCatalogDimensionLabelsFromListingRow(listing)
  if (dims.dimensions_summary) {
    sentences.push(`Dimensions: ${dims.dimensions_summary}.`)
  }
  const boardType = boardsBrowseBoardTypeLabel(listing.board_type)
  if (boardType) sentences.push(`Board type: ${boardType}.`)
  return sentences
}

function finSpecSentences(listing: GoogleMerchantListingDescriptionInput): string[] {
  const sentences: string[] = []
  const setup = finSetupLabel(listing.fins_setup)
  const system = finSystemLabel(listing.fin_system)
  const size = finSizeLabel(listing.fin_size)
  if (setup) sentences.push(`Fin setup: ${setup}.`)
  if (system) sentences.push(`Fin system: ${system}.`)
  if (size) sentences.push(`Size: ${size}.`)
  return sentences
}

function magazineSpecSentences(listing: GoogleMerchantListingDescriptionInput): string[] {
  const sentences: string[] = []
  const brand = listing.brand?.trim()
  if (brand) sentences.push(`Publisher: ${brand}.`)
  if (
    listing.magazine_year != null &&
    Number.isFinite(Number(listing.magazine_year))
  ) {
    sentences.push(`Publication year: ${listing.magazine_year}.`)
  }
  return sentences
}

function fulfillmentSentence(listing: GoogleMerchantListingDescriptionInput): string | null {
  const labels = boardFulfillmentDetailLabels(
    listing.local_pickup,
    listing.shipping_available,
    listing.shipping_price,
    listing.board_shipping_cost_mode as "reswell" | "flat" | "free" | null,
  )
  if (labels.length === 0) return null

  const location = locationPhrase(listing.city, listing.state)
  const parts = labels.join("; ")
  if (location && listing.local_pickup !== false) {
    return `Fulfillment: ${parts}. Local pickup near ${location}.`
  }
  return `Fulfillment: ${parts}.`
}

function introParagraph(listing: GoogleMerchantListingDescriptionInput): string {
  const title = capitalizeWords(listing.title.trim())
  const brand = listing.brand?.trim()
  const model = listing.model?.trim()
  const category = productCategoryLabel(listing.section)

  const nameParts = [brand, model].filter(Boolean)
  const productName =
    nameParts.length > 0 ? `${nameParts.join(" ")} ${category}` : title

  return ensureEndsWithPunctuation(
    `${title} is a ${category} for sale on Reswell, the peer-to-peer marketplace for surfboards and surf gear. ` +
      `This listing features a ${productName} offered at ${formatUsd(listing.price)}.`,
  )
}

function marketplaceTail(listing: GoogleMerchantListingDescriptionInput): string {
  return listing.section === "magazines"
    ? RESELL_MAGAZINE_MARKETPLACE_TAIL
    : RESELL_MARKETPLACE_TAIL
}

function visualDetailTail(listing: GoogleMerchantListingDescriptionInput): string {
  return listing.section === "magazines" ? MAGAZINE_VISUAL_DETAIL_TAIL : VISUAL_DETAIL_TAIL
}

const RESELL_MARKETPLACE_TAIL =
  "Shop with confidence on Reswell: every listing includes multiple seller photos so you can review deck, rails, bottom, and hardware before you buy. " +
  "Reswell offers secure checkout and buyer protection on eligible purchases. " +
  "Browse the full photo gallery and listing details on reswell.app."

const RESELL_MAGAZINE_MARKETPLACE_TAIL =
  "Shop with confidence on Reswell: every magazine listing includes cover and interior photos so you can review condition before you buy. " +
  "Reswell offers secure checkout and buyer protection on eligible purchases. " +
  "Browse the full photo gallery and listing details on reswell.app."

const VISUAL_DETAIL_TAIL =
  "Review the listing photos for shape, color, finish, fin boxes, leash plug, and any cosmetic wear described by the seller."

const MAGAZINE_VISUAL_DETAIL_TAIL =
  "Review the listing photos for cover art, spine wear, page condition, and any flaws described by the seller."

/**
 * Builds a Merchant Center `description` that meets Google's length guidance by
 * combining the seller's notes with structured product attributes.
 */
export function buildGoogleMerchantProductDescription(
  listing: GoogleMerchantListingDescriptionInput,
): string {
  const sellerNotes = stripHtml(listing.description?.trim() ?? "")
  const blocks: string[] = [introParagraph(listing)]

  const condition = conditionPhrase(listing.condition)
  if (condition) blocks.push(condition)

  if (listing.section === "fins") {
    blocks.push(...finSpecSentences(listing))
  } else if (listing.section === "magazines") {
    blocks.push(...magazineSpecSentences(listing))
  } else {
    blocks.push(...surfboardSpecSentences(listing))
  }

  const fulfillment = fulfillmentSentence(listing)
  if (fulfillment) blocks.push(fulfillment)

  if (sellerNotes.length > 0) {
    blocks.push(ensureEndsWithPunctuation(sellerNotes))
  }

  blocks.push(ensureEndsWithPunctuation(visualDetailTail(listing)))

  let description = blocks.filter(Boolean).join(" ")

  if (description.length < GOOGLE_MERCHANT_MIN_DESCRIPTION_LENGTH) {
    description = `${description} ${ensureEndsWithPunctuation(marketplaceTail(listing))}`
  }

  if (description.length < GOOGLE_MERCHANT_MIN_DESCRIPTION_LENGTH) {
    const brandModel =
      [listing.brand?.trim(), listing.model?.trim()].filter(Boolean).join(" ") || listing.title.trim()
    description = `${description} ${ensureEndsWithPunctuation(
      `Additional details for this ${productCategoryLabel(listing.section)}: ${brandModel} listed at ${formatUsd(listing.price)} on Reswell.`,
    )}`
  }

  description = truncateDescription(description, GOOGLE_MERCHANT_MAX_DESCRIPTION_LENGTH)
  return ensureEndsWithPunctuation(description)
}
