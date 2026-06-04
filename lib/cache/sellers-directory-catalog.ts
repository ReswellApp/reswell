import { unstable_cache } from "next/cache"
import type {
  SellerDirectoryCardShop,
  SellerDirectoryListingThumb,
} from "@/components/sellers/seller-directory-card"
import { listSellersDirectoryDemotedProfileIdsOrdered } from "@/lib/db/sellers-directory-demotions"
import {
  buildSellerDirectoryMosaicSlots,
  type SellerDirectoryMosaicSlot,
} from "@/lib/sellers/directory-mosaic-images"
import { fetchSellersDirectoryEligibleSellerIds } from "@/lib/sellers/directory-eligibility"
import { orderSellersWithDemotions } from "@/lib/sellers/directory-ranking"
import {
  deriveSellerDirectoryTileMeta,
  summarizeSellerReviews,
  type SellerDirectoryTileMeta,
  type SellerListingForTileMeta,
} from "@/lib/sellers/directory-tile-meta"
import { resolveSellerProfileDisplayImageUrl } from "@/lib/sellers/profile-display-image"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { createServiceRoleClient } from "@/lib/supabase/server"

/** Hourly cache for `/sellers` directory tiles (profiles, mosaic images, tile metadata). */
export const SELLERS_DIRECTORY_CACHE_TAG = "sellers-directory"
export const SELLERS_DIRECTORY_REVALIDATE_SECONDS = 60 * 60

const THUMB_PER_SELLER = 3
const LISTINGS_FETCH_CAP = 4000

const profilePublicFields =
  "id, seller_slug, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"

type ListingDirectoryRow = SellerDirectoryListingThumb &
  SellerListingForTileMeta & {
    user_id: string
  }

export type SellersDirectoryCachedTile = {
  shop: SellerDirectoryCardShop
  thumbs: SellerDirectoryListingThumb[]
  tileMeta: SellerDirectoryTileMeta
  avgRating: number
  reviewCount: number
  inventoryCount: number
  avatarSrc: string
  mosaicSlots: SellerDirectoryMosaicSlot[]
}

export type SellersDirectoryCatalog = {
  items: SellersDirectoryCachedTile[]
  totalInventory: number
}

function createSupabaseForSellersDirectoryCatalog() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createServiceRoleClient()
  }
  return createAnonSupabaseClient()
}

function sellerMatchesDirectoryQuery(shop: SellerDirectoryCardShop, term: string): boolean {
  const haystack = [
    shop.shop_name,
    shop.shop_description,
    shop.display_name,
    shop.city,
    shop.shop_address,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase()

  return haystack.includes(term)
}

export function filterSellersDirectoryCatalog(
  catalog: SellersDirectoryCatalog,
  q: string | undefined,
): SellersDirectoryCatalog {
  const term = (q ?? "").trim().toLowerCase()
  if (!term) return catalog

  const items = catalog.items.filter(({ shop }) => sellerMatchesDirectoryQuery(shop, term))
  const totalInventory = items.reduce((sum, item) => sum + item.inventoryCount, 0)
  return { items, totalInventory }
}

async function loadSellersDirectoryCatalogUncached(): Promise<SellersDirectoryCatalog> {
  const supabase = createSupabaseForSellersDirectoryCatalog()

  const { sellerIds, inventoryCountBySeller } =
    await fetchSellersDirectoryEligibleSellerIds(supabase)

  if (sellerIds.length === 0) {
    return { items: [], totalInventory: 0 }
  }

  const { data: shopsRaw, error: shopsError } = await supabase
    .from("profiles")
    .select(profilePublicFields)
    .in("id", sellerIds)

  if (shopsError) {
    console.error("[sellers-directory-catalog] profiles fetch:", shopsError)
    return { items: [], totalInventory: 0 }
  }

  const demotedOrder = await listSellersDirectoryDemotedProfileIdsOrdered(supabase)
  const orderedShops = orderSellersWithDemotions(shopsRaw ?? [], demotedOrder, (shop) => ({
    id: shop.id,
    sales_count: shop.sales_count,
    inventoryCount: inventoryCountBySeller.get(shop.id) ?? 0,
  }))

  const thumbsBySeller = new Map<string, SellerDirectoryListingThumb[]>()
  const listingsForMetaBySeller = new Map<string, SellerListingForTileMeta[]>()
  const orderedSellerIds = orderedShops.map((shop) => shop.id)

  const [{ data: invRows, error: invError }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, user_id, title, price, slug, section, created_at, city, state, shipping_available, listing_images (url, thumbnail_url, is_primary)",
      )
      .in("user_id", orderedSellerIds)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(LISTINGS_FETCH_CAP),
    supabase.from("reviews").select("reviewed_id, rating").in("reviewed_id", orderedSellerIds),
  ])

  const accumulateDirectoryListingRow = (row: ListingDirectoryRow) => {
    const metaRow: SellerListingForTileMeta = {
      city: row.city ?? null,
      state: row.state ?? null,
      shipping_available: row.shipping_available ?? null,
    }
    const metaList = listingsForMetaBySeller.get(row.user_id) ?? []
    metaList.push(metaRow)
    listingsForMetaBySeller.set(row.user_id, metaList)

    const cur = thumbsBySeller.get(row.user_id) ?? []
    if (cur.length < THUMB_PER_SELLER) {
      cur.push(row)
      thumbsBySeller.set(row.user_id, cur)
    }
  }

  if (invError) {
    console.error("[sellers-directory-catalog] inventory thumbnails:", invError)
  } else {
    for (const row of (invRows ?? []) as ListingDirectoryRow[]) {
      accumulateDirectoryListingRow(row)
    }
  }

  const sellerIdsNeedingSoldListings = orderedSellerIds.filter(
    (id) => (thumbsBySeller.get(id)?.length ?? 0) === 0,
  )

  if (sellerIdsNeedingSoldListings.length > 0) {
    const { data: soldRows, error: soldError } = await supabase
      .from("listings")
      .select(
        "id, user_id, title, price, slug, section, created_at, city, state, shipping_available, listing_images (url, thumbnail_url, is_primary)",
      )
      .in("user_id", sellerIdsNeedingSoldListings)
      .eq("status", "sold")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(LISTINGS_FETCH_CAP)

    if (soldError) {
      console.error("[sellers-directory-catalog] sold surfboard thumbnails:", soldError)
    } else {
      for (const row of (soldRows ?? []) as ListingDirectoryRow[]) {
        accumulateDirectoryListingRow(row)
      }
    }
  }

  const reviewsBySeller = new Map<string, { rating: number }[]>()
  for (const row of reviewRows ?? []) {
    const list = reviewsBySeller.get(row.reviewed_id) ?? []
    list.push({ rating: row.rating })
    reviewsBySeller.set(row.reviewed_id, list)
  }

  const items = orderedShops.map((shop) => {
    const shopRow = shop as SellerDirectoryCardShop
    const thumbs = thumbsBySeller.get(shop.id) ?? []
    const { avgRating, reviewCount } = summarizeSellerReviews(reviewsBySeller.get(shop.id))
    const inventoryCount = inventoryCountBySeller.get(shop.id) ?? 0

    return {
      shop: shopRow,
      thumbs,
      tileMeta: deriveSellerDirectoryTileMeta(listingsForMetaBySeller.get(shop.id) ?? []),
      avgRating,
      reviewCount,
      inventoryCount,
      avatarSrc: resolveSellerProfileDisplayImageUrl(shopRow, thumbs),
      mosaicSlots: buildSellerDirectoryMosaicSlots(thumbs, shopRow),
    }
  })

  const totalInventory = items.reduce((sum, item) => sum + item.inventoryCount, 0)
  return { items, totalInventory }
}

export const getCachedSellersDirectoryCatalog = unstable_cache(
  loadSellersDirectoryCatalogUncached,
  ["sellers-directory-catalog-v1"],
  {
    revalidate: SELLERS_DIRECTORY_REVALIDATE_SECONDS,
    tags: [SELLERS_DIRECTORY_CACHE_TAG],
  },
)
