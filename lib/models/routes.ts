import { slugify } from "../slugify.ts"

export const MODEL_PAGE_TABS = ["listings", "details", "price-guide", "reviews"] as const

/** Unique catalog lookups stay on `/search` until model pages launch from search. */
export const MARKETPLACE_SEARCH_OPENS_MODEL_PAGES = false

export type ModelPageTab = (typeof MODEL_PAGE_TABS)[number]

export const MODEL_PAGE_RESERVED_BRAND_SEGMENTS = new Set([
  "about",
  "accessories",
  "admin",
  "api",
  "apparel",
  "auth",
  "blog",
  "board-finder",
  "boardbags",
  "boards",
  "brands",
  "careers",
  "cart",
  "checkout",
  "cities",
  "contact",
  "cookies",
  "dashboard",
  "dev-fins-search-test",
  "dropoff",
  "embed",
  "faq",
  "favorites",
  "fins",
  "following",
  "giveaways",
  "help",
  "import",
  "jamboards",
  "l",
  "leashes",
  "listyoursurfboard",
  "magazines",
  "map",
  "messages",
  "mobile-terms",
  "offers",
  "openapi.json",
  "priceguide",
  "privacy",
  "protection-policy",
  "public-api",
  "ratereswell",
  "reswell",
  "reswellreviews",
  "return-policy",
  "review",
  "safety",
  "search",
  "sell",
  "seller",
  "seller-resources",
  "sellers",
  "shipping",
  "shipping-estimator",
  "site-assets",
  "sold",
  "successpage",
  "support",
  "surf-shops",
  "surfpacks",
  "terms",
  "threads",
  "traction",
  "we-buy",
  "wetsuits",
  "what-is-reswell",
])

export function isReservedModelPageBrandSegment(slug: string): boolean {
  return MODEL_PAGE_RESERVED_BRAND_SEGMENTS.has(slug.trim().toLowerCase())
}

export function modelPageSlug(name: string): string {
  return slugify(name)
}

export function findBrandModelBySlug<T extends { name: string }>(
  models: readonly T[],
  slug: string,
): T | null {
  const target = slug.trim().toLowerCase()
  if (!target) return null
  return models.find((model) => modelPageSlug(model.name) === target) ?? null
}

export function parseModelPageTab(raw: string | undefined): ModelPageTab {
  const value = raw?.trim().replace(/^#/, "")
  if (value === "details" || value === "price-guide" || value === "reviews") return value
  return "listings"
}

export function modelPageSectionId(tab: ModelPageTab): string {
  return tab
}

export function modelPageHref(
  brandSlug: string,
  modelSlug: string,
  tab: ModelPageTab = "listings",
): string {
  const path = `/${brandSlug.trim()}/${modelSlug.trim()}`
  if (tab === "listings") return path
  return `${path}#${modelPageSectionId(tab)}`
}

export function isModelPagePathname(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length !== 2) return false
  return !isReservedModelPageBrandSegment(parts[0] ?? "")
}
