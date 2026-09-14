import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  fetchMetaCatalogFeedPage,
  fetchMetaCatalogFeedPageForLocation,
} from "@/lib/db/metaCatalogFeed"
import { isListingDiscoveryEligible } from "@/lib/listing-public-visibility"
import {
  listingToMetaCatalogFeedItem,
  META_CATALOG_BROWNSTONE_SHOP_SELLER_EMAIL,
  META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL,
  META_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL,
  type MetaCatalogFeedContext,
  type MetaCatalogFeedItem,
} from "@/lib/meta/catalog-product"
import {
  META_CITY_CATALOG_MARKETS,
  type MetaCityCatalogMarket,
} from "@/lib/meta/city-catalog-feed"
import { findUserIdByEmail } from "@/lib/services/resolveUserIdByEmail"

const DEFAULT_MAX_ITEMS = 10_000

const META_CATALOG_CSV_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "google_product_category",
  "additional_image_link",
  "identifier_exists",
  "custom_label_0",
  "video[0].url",
] as const

const META_CITY_CATALOG_CSV_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "google_product_category",
  "additional_image_link",
  "identifier_exists",
  "custom_label_0",
  "custom_label_1",
  "video[0].url",
] as const

async function resolveShopUserIdByEnvOrEmail(
  supabase: SupabaseClient,
  options: {
    userIdEnv: string
    emailEnv: string
    defaultEmail: string
  },
): Promise<string | null> {
  const byIdRaw = process.env[options.userIdEnv]?.trim()
  if (byIdRaw) {
    const parsed = z.string().uuid().safeParse(byIdRaw)
    if (parsed.success) return parsed.data
    console.warn(
      `[meta] ${options.userIdEnv} is not a valid UUID; falling back to email lookup`,
    )
  }

  const email = process.env[options.emailEnv]?.trim() || options.defaultEmail
  return findUserIdByEmail(supabase, email)
}

/**
 * Resolves Hayden Garfield’s seller profile id for Meta `custom_label_0`.
 * Prefer `META_CATALOG_HAYDEN_SHOP_USER_ID`, else email
 * (`META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL` or haydensbsb@gmail.com).
 */
export async function resolveMetaCatalogHaydenShopUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  return resolveShopUserIdByEnvOrEmail(supabase, {
    userIdEnv: "META_CATALOG_HAYDEN_SHOP_USER_ID",
    emailEnv: "META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL",
    defaultEmail: META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL,
  })
}

/**
 * Resolves OutSurfing’s seller profile id for Meta `custom_label_0`.
 * Prefer `META_CATALOG_OUTSURFING_SHOP_USER_ID`, else email
 * (`META_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL` or davidacason@gmail.com).
 */
export async function resolveMetaCatalogOutSurfingShopUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  return resolveShopUserIdByEnvOrEmail(supabase, {
    userIdEnv: "META_CATALOG_OUTSURFING_SHOP_USER_ID",
    emailEnv: "META_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL",
    defaultEmail: META_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL,
  })
}

/**
 * Resolves Brownstone’s seller profile id for Meta `custom_label_0`.
 * Prefer `META_CATALOG_BROWNSTONE_SHOP_USER_ID`, else email
 * (`META_CATALOG_BROWNSTONE_SHOP_SELLER_EMAIL` or eric@questavolta.com).
 */
export async function resolveMetaCatalogBrownstoneShopUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  return resolveShopUserIdByEnvOrEmail(supabase, {
    userIdEnv: "META_CATALOG_BROWNSTONE_SHOP_USER_ID",
    emailEnv: "META_CATALOG_BROWNSTONE_SHOP_SELLER_EMAIL",
    defaultEmail: META_CATALOG_BROWNSTONE_SHOP_SELLER_EMAIL,
  })
}

function catalogFeedMaxItems(): number {
  const raw = process.env.META_CATALOG_FEED_MAX_ITEMS?.trim()
  if (!raw) return DEFAULT_MAX_ITEMS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_ITEMS
  return Math.min(parsed, 50_000)
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function buildMetaCatalogFeed(
  supabase: SupabaseClient,
): Promise<MetaCatalogFeedItem[]> {
  const maxItems = catalogFeedMaxItems()
  const feedContext = await resolveMetaCatalogShopContext(supabase)
  const items: MetaCatalogFeedItem[] = []
  let offset = 0

  while (items.length < maxItems) {
    const page = await fetchMetaCatalogFeedPage(supabase, offset)
    if (page.rows.length === 0) break

    for (const row of page.rows) {
      if (items.length >= maxItems) break
      const item = listingToMetaCatalogFeedItem(row, feedContext)
      if (item) items.push(item)
    }

    if (page.nextOffset == null) break
    offset = page.nextOffset
  }

  return items
}

async function resolveMetaCatalogShopContext(
  supabase: SupabaseClient,
): Promise<MetaCatalogFeedContext> {
  const [haydenShopUserId, outSurfingShopUserId, brownstoneShopUserId] = await Promise.all([
    resolveMetaCatalogHaydenShopUserId(supabase),
    resolveMetaCatalogOutSurfingShopUserId(supabase),
    resolveMetaCatalogBrownstoneShopUserId(supabase),
  ])
  return { haydenShopUserId, outSurfingShopUserId, brownstoneShopUserId }
}

/**
 * Active surfboards listed in the given city landings (default: Santa Barbara + Ventura).
 * `custom_label_1` is SantaBarbara | Ventura for Meta product-set ads.
 */
export async function buildMetaCityCatalogFeed(
  supabase: SupabaseClient,
  markets: readonly MetaCityCatalogMarket[] = META_CITY_CATALOG_MARKETS,
): Promise<MetaCatalogFeedItem[]> {
  const maxItems = catalogFeedMaxItems()
  const shopContext = await resolveMetaCatalogShopContext(supabase)
  const items: MetaCatalogFeedItem[] = []
  const seenIds = new Set<string>()

  for (const market of markets) {
    if (items.length >= maxItems) break
    let offset = 0

    while (items.length < maxItems) {
      const page = await fetchMetaCatalogFeedPageForLocation(
        supabase,
        market.locationLabel,
        offset,
      )
      if (page.rows.length === 0) break

      for (const row of page.rows) {
        if (items.length >= maxItems) break
        if (seenIds.has(row.id)) continue
        if (
          !isListingDiscoveryEligible({
            status: row.status ?? "active",
            title: row.title,
            hidden_from_site: row.hidden_from_site,
          })
        ) {
          continue
        }

        const item = listingToMetaCatalogFeedItem(row, {
          ...shopContext,
          cityCustomLabel: market.customLabel,
        })
        if (!item) continue
        seenIds.add(row.id)
        items.push(item)
      }

      if (page.nextOffset == null) break
      offset = page.nextOffset
    }
  }

  return items
}

function catalogItemsToCsv(
  items: MetaCatalogFeedItem[],
  headers: readonly (keyof MetaCatalogFeedItem)[],
): string {
  const lines = [headers.join(",")]

  for (const item of items) {
    const row = headers.map((header) => {
      const value = item[header]
      return escapeCsvField(value == null ? "" : String(value))
    })
    lines.push(row.join(","))
  }

  return `${lines.join("\n")}\n`
}

export function metaCatalogFeedToCsv(items: MetaCatalogFeedItem[]): string {
  return catalogItemsToCsv(items, META_CATALOG_CSV_HEADERS)
}

export function metaCityCatalogFeedToCsv(items: MetaCatalogFeedItem[]): string {
  return catalogItemsToCsv(items, META_CITY_CATALOG_CSV_HEADERS)
}

export function isMetaCatalogFeedAuthorized(request: Request): boolean {
  const secret = process.env.META_CATALOG_FEED_SECRET?.trim()
  if (!secret) return true

  const url = new URL(request.url)
  const tokenParam = url.searchParams.get("token")?.trim()
  if (tokenParam && tokenParam === secret) return true

  const authHeader = request.headers.get("authorization")?.trim()
  if (authHeader === `Bearer ${secret}`) return true

  return false
}

export type MetaCatalogFeedFormat = "csv" | "json"

export function resolveMetaCatalogFeedFormat(request: Request): MetaCatalogFeedFormat {
  const url = new URL(request.url)
  const formatParam = url.searchParams.get("format")?.trim().toLowerCase()
  if (formatParam === "json") return "json"

  const accept = request.headers.get("accept")?.toLowerCase() ?? ""
  if (accept.includes("application/json") && !accept.includes("text/csv")) {
    return "json"
  }

  return "csv"
}
