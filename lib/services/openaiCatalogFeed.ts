import { gzipSync } from "node:zlib"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { fetchOpenAiCatalogFeedPage } from "@/lib/db/openaiCatalogFeed"
import {
  listingToOpenAiCatalogFeedItem,
  type OpenAiCatalogFeedItem,
} from "@/lib/openai-commerce/catalog-product"
import {
  OPENAI_CATALOG_HAYDEN_SHOP_SELLER_EMAIL,
  OPENAI_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL,
} from "@/lib/openai-commerce/config"
import { findUserIdByEmail } from "@/lib/services/resolveUserIdByEmail"

const DEFAULT_MAX_ITEMS = 10_000

export const OPENAI_CATALOG_FEED_HEADERS = [
  "is_eligible_search",
  "is_eligible_checkout",
  "is_ads_eligible",
  "item_id",
  "title",
  "description",
  "url",
  "brand",
  "image_url",
  "additional_image_urls",
  "video_url",
  "price",
  "sale_price",
  "availability",
  "condition",
  "product_category",
  "seller_name",
  "marketplace_seller",
  "seller_url",
  "seller_privacy_policy",
  "seller_tos",
  "target_countries",
  "store_country",
  "is_digital",
  "mpn",
  "shipping",
  "pickup_method",
  "accepts_returns",
  "return_deadline_in_days",
  "accepts_exchanges",
  "return_policy",
  "size",
  "size_system",
  "listing_has_variations",
  "length",
  "width",
  "height",
  "dimensions",
  "dimensions_unit",
  "weight",
  "item_weight_unit",
  "age_group",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "custom_label_3",
  "ads_metadata",
] as const

type OpenAiCatalogFeedHeader = (typeof OPENAI_CATALOG_FEED_HEADERS)[number]

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
      `[openai-catalog] ${options.userIdEnv} is not a valid UUID; falling back to email lookup`,
    )
  }

  const email = process.env[options.emailEnv]?.trim() || options.defaultEmail
  return findUserIdByEmail(supabase, email)
}

function catalogFeedMaxItems(): number {
  const raw = process.env.OPENAI_CATALOG_FEED_MAX_ITEMS?.trim()
  if (!raw) return DEFAULT_MAX_ITEMS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_ITEMS
  return Math.min(parsed, 50_000)
}

export async function buildOpenAiCatalogFeed(
  supabase: SupabaseClient,
): Promise<OpenAiCatalogFeedItem[]> {
  const maxItems = catalogFeedMaxItems()
  const [haydenShopUserId, outSurfingShopUserId] = await Promise.all([
    resolveShopUserIdByEnvOrEmail(supabase, {
      userIdEnv: "OPENAI_CATALOG_HAYDEN_SHOP_USER_ID",
      emailEnv: "OPENAI_CATALOG_HAYDEN_SHOP_SELLER_EMAIL",
      defaultEmail: OPENAI_CATALOG_HAYDEN_SHOP_SELLER_EMAIL,
    }),
    resolveShopUserIdByEnvOrEmail(supabase, {
      userIdEnv: "OPENAI_CATALOG_OUTSURFING_SHOP_USER_ID",
      emailEnv: "OPENAI_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL",
      defaultEmail: OPENAI_CATALOG_OUTSURFING_SHOP_SELLER_EMAIL,
    }),
  ])
  const feedContext = { haydenShopUserId, outSurfingShopUserId }
  const items: OpenAiCatalogFeedItem[] = []
  let offset = 0

  while (items.length < maxItems) {
    const page = await fetchOpenAiCatalogFeedPage(supabase, offset)
    if (page.rows.length === 0) break

    for (const row of page.rows) {
      if (items.length >= maxItems) break
      const item = listingToOpenAiCatalogFeedItem(row, feedContext)
      if (item) items.push(item)
    }

    if (page.nextOffset == null) break
    offset = page.nextOffset
  }

  return items
}

function fieldValue(item: OpenAiCatalogFeedItem, header: OpenAiCatalogFeedHeader): string {
  const value = item[header]
  return value == null ? "" : String(value)
}

function escapeDelimitedField(value: string, delimiter: "," | "\t"): string {
  if (delimiter === "\t") {
    return value.replace(/\t/g, " ").replace(/\r?\n/g, " ")
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function openAiCatalogFeedToDelimited(
  items: OpenAiCatalogFeedItem[],
  delimiter: "," | "\t",
): string {
  const lines = [OPENAI_CATALOG_FEED_HEADERS.join(delimiter)]
  for (const item of items) {
    const row = OPENAI_CATALOG_FEED_HEADERS.map((header) =>
      escapeDelimitedField(fieldValue(item, header), delimiter),
    )
    lines.push(row.join(delimiter))
  }
  return `${lines.join("\n")}\n`
}

export function openAiCatalogFeedToTsv(items: OpenAiCatalogFeedItem[]): string {
  return openAiCatalogFeedToDelimited(items, "\t")
}

export function openAiCatalogFeedToCsv(items: OpenAiCatalogFeedItem[]): string {
  return openAiCatalogFeedToDelimited(items, ",")
}

export function gzipOpenAiCatalogFeed(body: string): Buffer {
  return gzipSync(Buffer.from(body, "utf8"))
}

export function isOpenAiCatalogFeedAuthorized(request: Request): boolean {
  const secret = process.env.OPENAI_CATALOG_FEED_SECRET?.trim()
  if (!secret) return true

  const url = new URL(request.url)
  const tokenParam = url.searchParams.get("token")?.trim()
  if (tokenParam && tokenParam === secret) return true

  const authHeader = request.headers.get("authorization")?.trim()
  if (authHeader === `Bearer ${secret}`) return true

  return false
}

export type OpenAiCatalogFeedFormat = "tsv" | "csv" | "json" | "tsv.gz" | "csv.gz"

export function resolveOpenAiCatalogFeedFormat(request: Request): OpenAiCatalogFeedFormat {
  const url = new URL(request.url)
  const formatParam = url.searchParams.get("format")?.trim().toLowerCase()
  if (formatParam === "json") return "json"
  if (formatParam === "csv") return "csv"
  if (formatParam === "csv.gz" || formatParam === "csv.gzip") return "csv.gz"
  if (formatParam === "tsv.gz" || formatParam === "tsv.gzip" || formatParam === "txt.gz") {
    return "tsv.gz"
  }

  const accept = request.headers.get("accept")?.toLowerCase() ?? ""
  if (accept.includes("application/json") && !accept.includes("text/")) {
    return "json"
  }
  if (accept.includes("text/csv")) return "csv"

  return "tsv"
}
