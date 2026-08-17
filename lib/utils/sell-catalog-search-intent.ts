import {
  SELL_CATALOG_SEARCH_CATEGORIES,
  type SellCatalogSearchCategory,
} from "@/lib/types/sell-catalog-search"

/**
 * Query understanding for `/sell` catalog ranking — no LLM.
 *
 * Sellers type variations ("hobie keels", "hobie fish fins") instead of the
 * catalog title ("Hobie Fish"). Category and style words must not be required
 * name tokens, but they should steer which category ranks first.
 */

const HARD_CATEGORY_TOKENS: Record<string, SellCatalogSearchCategory> = {
  fin: "fins",
  fins: "fins",
  finset: "fins",
  surfboard: "surfboards",
  surfboards: "surfboards",
  wetsuit: "wetsuits",
  wetsuits: "wetsuits",
  steamer: "wetsuits",
  springsuit: "wetsuits",
  apparel: "apparel",
  hoodie: "apparel",
  hoodies: "apparel",
  tee: "apparel",
  tees: "apparel",
  shirt: "apparel",
  shirts: "apparel",
  boardshort: "apparel",
  boardshorts: "apparel",
}

/** Soft shape/style hints — boost a category, never hide the others. */
const SOFT_CATEGORY_TOKENS: Record<string, SellCatalogSearchCategory> = {
  keel: "fins",
  keels: "fins",
  sidebite: "fins",
  sidebites: "fins",
  longboard: "surfboards",
  shortboard: "surfboards",
  midlength: "surfboards",
  log: "surfboards",
}

const STYLE_TOKENS = new Set([
  "keel",
  "keels",
  "twin",
  "thruster",
  "quad",
  "single",
  "sidebite",
  "sidebites",
])

const LISTING_CHATTER_TOKENS = new Set([
  "new",
  "used",
  "mint",
  "excellent",
  "good",
  "fair",
  "condition",
  "barely",
  "never",
  "ding",
  "dings",
  "repaired",
  "size",
  "set",
  "sets",
])

export type SellCatalogSearchIntent = {
  /** Explicit category word in the query (`fins`, `surfboard`, …). */
  lockedCategory: SellCatalogSearchCategory | null
  /** Style/shape hint when no hard lock (`keels` → fins). */
  preferredCategory: SellCatalogSearchCategory | null
  wantsKeel: boolean
}

export function tokenizeSellCatalogQuery(raw: string): string[] {
  const tokens = raw.toLowerCase().match(/[\w']+/g) ?? []
  const out: string[] = []
  const seen = new Set<string>()
  for (const token of tokens) {
    const t = token.replace(/^['']+|['']+$/g, "")
    if (t.length < 2 || /^\d+$/.test(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function isSellCatalogOptionalSearchToken(token: string): boolean {
  const t = token.toLowerCase()
  return (
    t in HARD_CATEGORY_TOKENS ||
    t in SOFT_CATEGORY_TOKENS ||
    STYLE_TOKENS.has(t) ||
    LISTING_CHATTER_TOKENS.has(t)
  )
}

export function parseSellCatalogSearchIntent(rawQuery: string): SellCatalogSearchIntent {
  const tokens = tokenizeSellCatalogQuery(rawQuery)
  const hard = tokens
    .map((token) => HARD_CATEGORY_TOKENS[token])
    .filter((category): category is SellCatalogSearchCategory => Boolean(category))

  let lockedCategory: SellCatalogSearchCategory | null = null
  if (hard.includes("fins")) {
    lockedCategory = "fins"
  } else if (hard.length > 0) {
    lockedCategory = hard[0] ?? null
  }

  const soft = tokens
    .map((token) => SOFT_CATEGORY_TOKENS[token])
    .filter((category): category is SellCatalogSearchCategory => Boolean(category))

  const preferredCategory =
    lockedCategory ??
    (soft.includes("fins") ? "fins" : (soft[0] ?? null))

  return {
    lockedCategory,
    preferredCategory,
    wantsKeel: tokens.includes("keel") || tokens.includes("keels"),
  }
}

export function resolveSellCatalogSearchCategories(
  allowed: readonly SellCatalogSearchCategory[],
  intent: SellCatalogSearchIntent,
): SellCatalogSearchCategory[] {
  if (!intent.lockedCategory) return [...allowed]
  if (allowed.includes(intent.lockedCategory)) return [intent.lockedCategory]
  return [...allowed]
}

export function sellCatalogSearchCategoryRank(
  category: SellCatalogSearchCategory,
  intent: SellCatalogSearchIntent,
): number {
  const target = intent.lockedCategory ?? intent.preferredCategory
  if (!target) return SELL_CATALOG_SEARCH_CATEGORIES.indexOf(category)
  if (category === target) return -1
  return SELL_CATALOG_SEARCH_CATEGORIES.indexOf(category)
}
