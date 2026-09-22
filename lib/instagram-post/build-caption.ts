import { formatStoredListingDimensions } from "../listing-dimensions-display.ts"
import { capitalizeWords, formatBoardType, formatHomePeerListingConditionLine } from "../listing-labels.ts"
import { FIN_SETUP_LABELS, parseFinsSetupFromStorage } from "../listing-fin-setup-tags.ts"
import { isPeerListingSection, PEER_LISTING_SECTION_LABELS } from "../peer-listing-sections.ts"

/** Instagram caption hard limit. */
export const INSTAGRAM_CAPTION_MAX = 2200

export const DEFAULT_HAYDEN_SHOP_NAME = "Hayden Garfield Shop"

const CONSTRUCTION_LABELS: Record<string, string> = {
  eps_epoxy: "EPS/Epoxy",
  pu_poly: "PU/Poly",
  carbon: "Carbon",
}

const FIN_SYSTEM_LABELS: Record<string, string> = {
  futures: "Futures",
  fcs_ii: "FCS II",
  fcs_twin_tab: "FCS Twin Tab",
  single: "Single Fin",
  two_plus_one_futures: "2+1 (Futures Side Bites)",
  two_plus_one_fcs: "2+1 (FCS Side Bites)",
  glass_on: "Glass On",
}

export type InstagramPostListingSource = {
  title: string
  description?: string | null
  price: number
  section?: string | null
  board_type?: string | null
  brand?: string | null
  model?: string | null
  condition?: string | null
  dimensions?: string | null
  construction?: string | null
  fin_system?: string | null
  fins_setup?: string | null
  fins_included?: boolean | null
  listingUrl: string
  shopName?: string | null
}

export function stripHtmlToPlainText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export function formatInstagramPrice(price: number): string {
  const fractionDigits = Number.isInteger(price) ? 0 : 2
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(price)
}

function sectionLabel(section: string | null | undefined): string | null {
  const value = section?.trim() ?? ""
  if (!value) return null
  if (isPeerListingSection(value)) return PEER_LISTING_SECTION_LABELS[value]
  return capitalizeWords(value.replace(/_/g, " "))
}

function optionLabel(map: Record<string, string>, slug: string | null | undefined): string | null {
  const value = slug?.trim() ?? ""
  if (!value || value === "other") return null
  return map[value] ?? null
}

function detailLines(listing: InstagramPostListingSource): string[] {
  const lines: string[] = []
  const brand = listing.brand?.trim()
  const model = listing.model?.trim()
  if (brand) lines.push(`Brand: ${brand}`)
  if (model) lines.push(`Model: ${model}`)

  const boardType = formatBoardType(listing.board_type)
  if (boardType) {
    lines.push(`Type: ${boardType}`)
  } else {
    const section = sectionLabel(listing.section)
    if (section && listing.section !== "surfboards") lines.push(`Category: ${section}`)
  }

  const condition = formatHomePeerListingConditionLine(listing.condition)?.replace(" — ", " – ")
  if (condition) lines.push(`Condition: ${condition}`)

  const dimensions = formatStoredListingDimensions(listing.dimensions)
  if (dimensions) lines.push(`Dimensions: ${dimensions}`)

  const construction = optionLabel(CONSTRUCTION_LABELS, listing.construction)
  if (construction) lines.push(`Construction: ${construction}`)

  const finSystem = optionLabel(FIN_SYSTEM_LABELS, listing.fin_system)
  if (finSystem) lines.push(`Fin system: ${finSystem}`)

  const setups = parseFinsSetupFromStorage(listing.fins_setup).filter((slug) => slug !== "other")
  if (setups.length > 0) {
    lines.push(`Fin setup: ${setups.map((slug) => FIN_SETUP_LABELS[slug]).join(", ")}`)
  }

  if (listing.fins_included === true) lines.push("Fins included: Included")
  if (listing.fins_included === false) lines.push("Fins included: Not included")

  return lines
}

function truncateCaption(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

/**
 * Copy-paste Instagram caption: title, price, specs, description, and listing link.
 * Keeps the shop URL even if the description has to be shortened.
 */
export function buildInstagramPostCaption(listing: InstagramPostListingSource): string {
  const title = capitalizeWords(listing.title.trim()) || "Untitled listing"
  const price = Number.isFinite(listing.price) ? formatInstagramPrice(listing.price) : ""
  const details = detailLines(listing)
  const description = stripHtmlToPlainText(listing.description ?? "")
  const shopName = listing.shopName?.trim() || DEFAULT_HAYDEN_SHOP_NAME
  const listingUrl = listing.listingUrl.trim()

  const header = [title, price].filter(Boolean).join("\n")
  const footer = [`Shop this listing: ${listingUrl}`, shopName].join("\n")
  const reserved = [header, details.join("\n"), footer].filter((part) => part.length > 0)
  const reservedLength = reserved.join("\n\n").length
  const separators = description ? 2 : 0
  const descriptionBudget = INSTAGRAM_CAPTION_MAX - reservedLength - separators

  const parts = [header]
  if (details.length > 0) parts.push(details.join("\n"))
  if (description && descriptionBudget > 20) {
    parts.push(truncateCaption(description, descriptionBudget))
  }
  parts.push(footer)

  return truncateCaption(parts.filter(Boolean).join("\n\n"), INSTAGRAM_CAPTION_MAX)
}

export type InstagramListingImage = {
  url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export function orderedListingFullImageUrls(images: InstagramListingImage[] | null | undefined): string[] {
  const list = [...(images ?? [])].sort((a, b) => {
    if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1
    return (a.sort_order ?? 999) - (b.sort_order ?? 999)
  })
  const urls: string[] = []
  const seen = new Set<string>()
  for (const image of list) {
    const url = image.url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}
