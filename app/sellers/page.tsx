import Link from "next/link"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Store, Users } from "lucide-react"
import { SellersBreadcrumbs } from "@/components/sellers/sellers-breadcrumbs"
import { SellersPageSellCta } from "@/components/sellers/sellers-page-sell-cta"
import { SellersDirectoryAdminBar } from "@/components/sellers/sellers-directory-admin-bar"
import { SellersDirectorySearch } from "@/components/sellers/sellers-directory-search"
import { SellersDirectoryGrid } from "@/components/sellers/sellers-directory-grid"
import { listSellersDirectoryDemotedProfileIdsOrdered } from "@/lib/db/sellers-directory-demotions"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { fetchSellersDirectoryEligibleSellerIds } from "@/lib/sellers/directory-eligibility"
import { orderSellersWithDemotions } from "@/lib/sellers/directory-ranking"
import {
  deriveSellerDirectoryTileMeta,
  summarizeSellerReviews,
  type SellerListingForTileMeta,
} from "@/lib/sellers/directory-tile-meta"
import type { SellerDirectoryListingThumb } from "@/components/sellers/seller-directory-card"

const THUMB_PER_SELLER = 3
const LISTINGS_FETCH_CAP = 4000

type ListingDirectoryRow = SellerDirectoryListingThumb &
  SellerListingForTileMeta & {
    user_id: string
  }

export async function generateMetadata() {
  return resolvePageMetadata("sellers")
}

/**
 * Public directory reads: use the service role when configured so anonymous visitors
 * still see sellers even if RLS only allows authenticated `profiles` / `listings` reads.
 * Falls back to the cookie-aware anon client (logged-in users) when the key is missing.
 */
async function getSupabaseForPublicSellersDirectory() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createServiceRoleClient()
  }
  return createClient()
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await getSupabaseForPublicSellersDirectory()
  const authClient = await createClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  const profilePublicFields =
    "id, seller_slug, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"

  const { sellerIds, inventoryCountBySeller } =
    await fetchSellersDirectoryEligibleSellerIds(supabase)

  const shopsRaw =
    sellerIds.length === 0
      ? []
      : await (async () => {
          let query = supabase.from("profiles").select(profilePublicFields).in("id", sellerIds)

          if (q) {
            query = query.or(
              `shop_name.ilike.%${q}%,shop_description.ilike.%${q}%,display_name.ilike.%${q}%,city.ilike.%${q}%,shop_address.ilike.%${q}%`,
            )
          }

          const { data, error } = await query
          if (error) {
            console.error("[sellers] profiles fetch:", error)
            return []
          }
          return data ?? []
        })()

  const demotedOrder = await listSellersDirectoryDemotedProfileIdsOrdered(supabase)
  const orderedShops = orderSellersWithDemotions(shopsRaw, demotedOrder, (shop) => ({
    id: shop.id,
    sales_count: shop.sales_count,
    inventoryCount: inventoryCountBySeller.get(shop.id) ?? 0,
  }))

  /** Thumbnails + tile metadata from active listings (single pass). */
  const thumbsBySeller = new Map<string, SellerDirectoryListingThumb[]>()
  const listingsForMetaBySeller = new Map<string, SellerListingForTileMeta[]>()

  const orderedSellerIds = orderedShops.map((s) => s.id)

  const [{ data: invRows, error: invError }, { data: reviewRows }, { data: followRows }] =
    await Promise.all([
      orderedShops.length === 0
        ? Promise.resolve({ data: [] as ListingDirectoryRow[], error: null })
        : supabase
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
      orderedShops.length === 0
        ? Promise.resolve({ data: [] as { reviewed_id: string; rating: number }[] })
        : supabase.from("reviews").select("reviewed_id, rating").in("reviewed_id", orderedSellerIds),
      user && orderedShops.length > 0
        ? authClient
            .from("seller_follows")
            .select("seller_id")
            .eq("follower_id", user.id)
            .in("seller_id", orderedSellerIds)
        : Promise.resolve({ data: [] as { seller_id: string }[] }),
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
    console.error("[sellers] inventory thumbnails:", invError)
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
      console.error("[sellers] sold surfboard thumbnails:", soldError)
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

  const followingSet = new Set((followRows ?? []).map((row) => row.seller_id))

  const gridItems = orderedShops.map((shop) => {
    const { avgRating, reviewCount } = summarizeSellerReviews(reviewsBySeller.get(shop.id))
    return {
      shop,
      thumbs: thumbsBySeller.get(shop.id) ?? [],
      tileMeta: deriveSellerDirectoryTileMeta(listingsForMetaBySeller.get(shop.id) ?? []),
      avgRating,
      reviewCount,
      initialFollowing: followingSet.has(shop.id),
      isOwnProfile: user?.id === shop.id,
    }
  })

  const totalInventory = orderedShops.reduce(
    (sum, shop) => sum + (inventoryCountBySeller.get(shop.id) ?? 0),
    0,
  )

  return (
    <main className="flex-1">
      <section className="border-b border-border/60 bg-offwhite py-10 sm:py-12">
        <div className="container relative mx-auto px-4 sm:px-6">
          <div className="absolute right-2 top-0 z-10 sm:right-4">
            <SellersDirectoryAdminBar />
          </div>
          <SellersBreadcrumbs className="mb-6 min-w-0 max-w-full sm:mb-8" />
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Explore sellers on Reswell
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground text-pretty sm:text-base">
              Every board you buy on Reswell supports another surfer just like you. Browse profiles below to find
              sellers near you or who offer shipping to your area.
            </p>
            {orderedShops.length > 0 ? (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {orderedShops.length} seller{orderedShops.length !== 1 ? "s" : ""}
                {totalInventory > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    {totalInventory} active listing{totalInventory !== 1 ? "s" : ""}
                  </>
                ) : null}
              </p>
            ) : null}
            <SellersDirectorySearch defaultValue={q || ""} className="mx-auto mt-7 max-w-lg" />
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          {q ? (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {orderedShops.length} seller{orderedShops.length !== 1 ? "s" : ""} found for “{q}”
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sellers">Clear search</Link>
              </Button>
            </div>
          ) : null}

          {orderedShops.length === 0 ? (
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Store className="h-7 w-7 text-muted-foreground" aria-hidden />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No sellers found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {q ? "Try different search terms." : "Check back soon as more sellers join Reswell."}
              </p>
              {!q ? (
                <Button className="mt-6 rounded-full" asChild>
                  <Link href="/auth/sign-up">Join Reswell</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <SellersDirectoryGrid items={gridItems} isLoggedIn={!!user} />
          )}
        </div>
      </section>

      {!user ? (
        <div className="border-t border-border/60">
          <SellersPageSellCta />
        </div>
      ) : null}
    </main>
  )
}
