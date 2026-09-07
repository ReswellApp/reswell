import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import { RESWELL_SHOP_SECTION } from "@/lib/reswell-shop"

/** Peer marketplace + Reswell shop inventory included in the ChatGPT product feed. */
export const OPENAI_CATALOG_SECTIONS = [
  ...PEER_LISTING_SECTIONS,
  RESWELL_SHOP_SECTION,
] as const

export type OpenAiCatalogSection = (typeof OPENAI_CATALOG_SECTIONS)[number]

const OPENAI_CATALOG_SECTION_SET = new Set<string>(OPENAI_CATALOG_SECTIONS)

export function isOpenAiCatalogSection(section: string): section is OpenAiCatalogSection {
  return OPENAI_CATALOG_SECTION_SET.has(section)
}

export const OPENAI_CATALOG_SECTIONS_FILTER: string[] = [...OPENAI_CATALOG_SECTIONS]

export const OPENAI_CATALOG_MERCHANT_NAME = "Reswell"
export const OPENAI_CATALOG_DEFAULT_BRAND = "Reswell"

export const OPENAI_CATALOG_HAYDEN_SHOP_SELLER_EMAIL = "haydensbsb@gmail.com"
export const OPENAI_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL = "davidacason@gmail.com"
export const OPENAI_CATALOG_DEFAULT_HAYDEN_SHOP_CUSTOM_LABEL = "HaydenGarfield"
export const OPENAI_CATALOG_DEFAULT_OUTSURFING_SHOP_CUSTOM_LABEL = "OutSurfing"

/** Google product taxonomy paths — OpenAI `product_category` uses `>` separators. */
export const OPENAI_CATALOG_PRODUCT_CATEGORY: Record<string, string> = {
  surfboards:
    "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Surfing > Surfboards",
  fins: "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Surfing > Surfboard Fins",
  wetsuits:
    "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Boating & Water Sport Apparel",
  apparel:
    "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Boating & Water Sport Apparel",
  magazines: "Media > Magazines & Newspapers > Magazines",
  boardbags: "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Surfing",
  surfpacks: "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Surfing",
  leashes: "Sporting Goods > Outdoor Recreation > Boating & Water Sports > Surfing",
  accessories: "Sporting Goods > Outdoor Recreation > Boating & Water Sports",
  [RESWELL_SHOP_SECTION]: "Sporting Goods > Outdoor Recreation > Boating & Water Sports",
}

const DEFAULT_ESTIMATED_SHIPPING_USD: Record<string, number> = {
  surfboards: 89,
  fins: 15,
  magazines: 10,
  wetsuits: 20,
  apparel: 12,
  boardbags: 25,
  surfpacks: 20,
  leashes: 12,
  accessories: 12,
  [RESWELL_SHOP_SECTION]: 12,
}

export function getOpenAiCatalogProductCategory(section: string): string {
  return (
    OPENAI_CATALOG_PRODUCT_CATEGORY[section] ??
    OPENAI_CATALOG_PRODUCT_CATEGORY.surfboards
  )
}

export function getOpenAiCatalogCustomLabel0(section: string): string {
  if (section === RESWELL_SHOP_SECTION) return "ReswellShop"
  if (section === "surfboards") return "Surfboards"
  if (section === "fins") return "Fins"
  if (section === "wetsuits") return "Wetsuits"
  if (section === "magazines") return "Magazines"
  if (section === "apparel") return "Apparel"
  if (section === "boardbags") return "Boardbags"
  if (section === "surfpacks") return "Surfpacks"
  if (section === "leashes") return "Leashes"
  if (section === "accessories") return "Accessories"
  return section
}

export function getOpenAiCatalogHaydenShopCustomLabel(): string {
  return (
    process.env.OPENAI_CATALOG_HAYDEN_SHOP_CUSTOM_LABEL?.trim() ||
    OPENAI_CATALOG_DEFAULT_HAYDEN_SHOP_CUSTOM_LABEL
  )
}

export function getOpenAiCatalogOutSurfingShopCustomLabel(): string {
  return (
    process.env.OPENAI_CATALOG_OUTSURFING_SHOP_CUSTOM_LABEL?.trim() ||
    OPENAI_CATALOG_DEFAULT_OUTSURFING_SHOP_CUSTOM_LABEL
  )
}

export function getOpenAiCatalogEstimatedShippingUsd(section: string): number {
  const envKey = `OPENAI_CATALOG_${section.toUpperCase()}_ESTIMATED_SHIPPING_USD`
  const raw = process.env[envKey]?.trim()
  if (raw) {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed) && parsed >= 0) return Math.round(parsed * 100) / 100
  }
  return DEFAULT_ESTIMATED_SHIPPING_USD[section] ?? DEFAULT_ESTIMATED_SHIPPING_USD.surfboards
}

export const OPENAI_CATALOG_MAX_ADDITIONAL_IMAGES = 10
export const OPENAI_CATALOG_MAX_TITLE_LENGTH = 150
export const OPENAI_CATALOG_MAX_DESCRIPTION_LENGTH = 5000
export const OPENAI_CATALOG_MAX_BRAND_LENGTH = 70
export const OPENAI_CATALOG_MAX_SELLER_NAME_LENGTH = 70
export const OPENAI_CATALOG_MAX_MPN_LENGTH = 70
export const OPENAI_CATALOG_MAX_SIZE_LENGTH = 20
