import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchKlaviyoCatalogFeedPage } from "@/lib/db/klaviyoCatalogFeed"
import {
  listingToKlaviyoCatalogFeedItem,
  type KlaviyoCatalogFeedItem,
} from "@/lib/klaviyo/catalog-product"

const DEFAULT_MAX_ITEMS = 10_000

function catalogFeedMaxItems(): number {
  const raw = process.env.KLAVIYO_CATALOG_FEED_MAX_ITEMS?.trim()
  if (!raw) return DEFAULT_MAX_ITEMS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_ITEMS
  return Math.min(parsed, 50_000)
}

export async function buildKlaviyoCatalogFeed(
  supabase: SupabaseClient,
): Promise<KlaviyoCatalogFeedItem[]> {
  const maxItems = catalogFeedMaxItems()
  const items: KlaviyoCatalogFeedItem[] = []
  let offset = 0

  while (items.length < maxItems) {
    const page = await fetchKlaviyoCatalogFeedPage(supabase, offset)
    if (page.rows.length === 0) break

    for (const row of page.rows) {
      if (items.length >= maxItems) break
      if (!row.id?.trim()) continue
      items.push(listingToKlaviyoCatalogFeedItem(row))
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
