import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { fetchKlaviyoCatalogFeedPage } from "@/lib/db/klaviyoCatalogFeed"
import {
  KLAVIYO_HAYDEN_SHOP_SELLER_EMAIL,
  listingToKlaviyoCatalogFeedItem,
  type KlaviyoCatalogFeedItem,
} from "@/lib/klaviyo/catalog-product"
import { findUserIdByEmail } from "@/lib/services/resolveUserIdByEmail"

const DEFAULT_MAX_ITEMS = 10_000

function catalogFeedMaxItems(): number {
  const raw = process.env.KLAVIYO_CATALOG_FEED_MAX_ITEMS?.trim()
  if (!raw) return DEFAULT_MAX_ITEMS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_ITEMS
  return Math.min(parsed, 50_000)
}

/**
 * Hayden Garfield’s seller id for the `Hayden Garfields Shop` catalog category.
 * Prefer `KLAVIYO_CATALOG_HAYDEN_SHOP_USER_ID`, else email
 * (`KLAVIYO_CATALOG_HAYDEN_SHOP_SELLER_EMAIL` or haydensbsb@gmail.com).
 */
export async function resolveKlaviyoHaydenShopUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const byIdRaw = process.env.KLAVIYO_CATALOG_HAYDEN_SHOP_USER_ID?.trim()
  if (byIdRaw) {
    const parsed = z.string().uuid().safeParse(byIdRaw)
    if (parsed.success) return parsed.data
    console.warn(
      "[klaviyo] KLAVIYO_CATALOG_HAYDEN_SHOP_USER_ID is not a valid UUID; falling back to email lookup",
    )
  }

  const email =
    process.env.KLAVIYO_CATALOG_HAYDEN_SHOP_SELLER_EMAIL?.trim() ||
    KLAVIYO_HAYDEN_SHOP_SELLER_EMAIL
  return findUserIdByEmail(supabase, email)
}

export async function buildKlaviyoCatalogFeed(
  supabase: SupabaseClient,
): Promise<KlaviyoCatalogFeedItem[]> {
  const maxItems = catalogFeedMaxItems()
  let haydenShopUserId: string | null = null
  try {
    haydenShopUserId = await resolveKlaviyoHaydenShopUserId(supabase)
  } catch (error) {
    console.error("[klaviyo] catalog feed: Hayden shop lookup failed", error)
  }

  const items: KlaviyoCatalogFeedItem[] = []
  let offset = 0

  while (items.length < maxItems) {
    const page = await fetchKlaviyoCatalogFeedPage(supabase, offset)
    if (page.rows.length === 0) break

    for (const row of page.rows) {
      if (items.length >= maxItems) break
      if (!row.id?.trim()) continue
      items.push(listingToKlaviyoCatalogFeedItem(row, { haydenShopUserId }))
    }

    if (page.nextOffset == null) break
    offset = page.nextOffset
  }

  return items
}

export function isKlaviyoCatalogFeedAuthorized(request: Request): boolean {
  const secret = process.env.KLAVIYO_CATALOG_FEED_SECRET?.trim()
  if (!secret) return true

  const url = new URL(request.url)
  const tokenParam = url.searchParams.get("token")?.trim()
  if (tokenParam && tokenParam === secret) return true

  const authHeader = request.headers.get("authorization")?.trim()
  if (authHeader === `Bearer ${secret}`) return true

  return false
}
