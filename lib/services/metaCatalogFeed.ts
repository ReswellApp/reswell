import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { fetchMetaCatalogFeedPage } from "@/lib/db/metaCatalogFeed"
import {
  listingToMetaCatalogFeedItem,
  META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL,
  type MetaCatalogFeedItem,
} from "@/lib/meta/catalog-product"
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
] as const

/**
 * Resolves Hayden Garfield’s seller profile id for Meta `custom_label_0`.
 * Prefer `META_CATALOG_HAYDEN_SHOP_USER_ID`, else email
 * (`META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL` or haydensbsb@gmail.com).
 */
export async function resolveMetaCatalogHaydenShopUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const byIdRaw = process.env.META_CATALOG_HAYDEN_SHOP_USER_ID?.trim()
  if (byIdRaw) {
    const parsed = z.string().uuid().safeParse(byIdRaw)
    if (parsed.success) return parsed.data
    console.warn(
      "[meta] META_CATALOG_HAYDEN_SHOP_USER_ID is not a valid UUID; falling back to email lookup",
    )
  }

  const email =
    process.env.META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL?.trim() ||
    META_CATALOG_HAYDEN_SHOP_SELLER_EMAIL
  return findUserIdByEmail(supabase, email)
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
  const haydenShopUserId = await resolveMetaCatalogHaydenShopUserId(supabase)
  const feedContext = { haydenShopUserId }
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

export function metaCatalogFeedToCsv(items: MetaCatalogFeedItem[]): string {
  const lines = [META_CATALOG_CSV_HEADERS.join(",")]

  for (const item of items) {
    const row = META_CATALOG_CSV_HEADERS.map((header) => {
      const value = item[header]
      return escapeCsvField(value == null ? "" : String(value))
    })
    lines.push(row.join(","))
  }

  return `${lines.join("\n")}\n`
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
