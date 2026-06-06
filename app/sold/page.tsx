import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getCachedMarketplaceNewListingsFeedPage,
  getCachedMarketplaceSoldFeed,
} from "@/lib/cache/marketplace-sold-feed"
import {
  marketplaceFeedHref,
  parseMarketplaceFeedPage,
  parseMarketplaceFeedTab,
  type MarketplaceFeedTab,
} from "@/lib/marketplace-feed-tab"
import { MarketplaceFeedPageShell } from "@/components/features/marketplace/marketplace-feed-page-shell"
import { NewListingsFeedPanel } from "@/components/features/marketplace/new-listings-feed-panel"
import { SoldFeedPanel } from "./sold-page-client"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

/** ISR for `/sold` feeds — public listing data is also wrapped in `unstable_cache`. */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("sold")
}

async function loadViewerFavorites(): Promise<{
  favoritedListingIds: string[]
  viewerUserId: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { favoritedListingIds: [], viewerUserId: null }
  }

  const { data: favs } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)

  return {
    favoritedListingIds: (favs ?? []).map((f) => f.listing_id),
    viewerUserId: user.id,
  }
}

async function FeedPageData({
  brandSlug,
  activeTab,
  page,
}: {
  brandSlug: string | null
  activeTab: MarketplaceFeedTab
  page: number
}) {
  if (activeTab === "new") {
    const [{ listings, totalCount, totalPages }, { favoritedListingIds, viewerUserId }] =
      await Promise.all([
        getCachedMarketplaceNewListingsFeedPage(page),
        loadViewerFavorites(),
      ])

    if (page > totalPages && totalCount > 0) {
      redirect(
        marketplaceFeedHref("new", {
          page: totalPages > 1 ? totalPages : undefined,
        }),
      )
    }

    return (
      <MarketplaceFeedPageShell
        activeTab="new"
        newListingsPanel={
          <NewListingsFeedPanel
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            viewerUserId={viewerUserId}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
          />
        }
      />
    )
  }

  if (activeTab === "shipped") {
    const { soldListings, soldStats, brandFilterName, brandUnknown } =
      await getCachedMarketplaceSoldFeed(brandSlug, true)

    return (
      <MarketplaceFeedPageShell
        activeTab="shipped"
        brandFilterName={brandFilterName}
        brandUnknown={brandUnknown}
        shippedPanel={
          <SoldFeedPanel
            soldListings={soldListings}
            soldStats={soldStats}
            variant="shipped"
          />
        }
      />
    )
  }

  const { soldListings, soldStats, brandFilterName, brandUnknown } =
    await getCachedMarketplaceSoldFeed(brandSlug, false)

  return (
    <MarketplaceFeedPageShell
      activeTab="sold"
      brandFilterName={brandFilterName}
      brandUnknown={brandUnknown}
      soldPanel={<SoldFeedPanel soldListings={soldListings} soldStats={soldStats} />}
    />
  )
}

type SoldPageProps = {
  searchParams: Promise<{ brandSlug?: string; tab?: string; page?: string }>
}

function FeedPageFallback({ activeTab }: { activeTab: MarketplaceFeedTab }) {
  return (
    <>
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <Skeleton className="h-8 w-48 max-w-[85%]" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <Skeleton className="mt-6 h-10 w-full max-w-md rounded-full" />
        </div>
      </section>
      <section className="container mx-auto py-6">
        {activeTab === "sold" || activeTab === "shipped" || activeTab === "new" ? (
          <Skeleton className="mb-6 h-[3.25rem] w-full max-w-xl mx-auto rounded-lg" />
        ) : null}
        <ListingTileGridSkeleton
          count={10}
          ariaLabel={
            activeTab === "new"
              ? "Loading new listings"
              : activeTab === "shipped"
                ? "Loading shipped boards"
                : "Loading recently sold listings"
          }
        />
      </section>
    </>
  )
}

export default async function SoldPage({ searchParams }: SoldPageProps) {
  const { brandSlug: brandSlugRaw, tab: tabRaw, page: pageRaw } = await searchParams
  const brandSlug = brandSlugRaw?.trim() || null
  const activeTab = parseMarketplaceFeedTab(tabRaw)
  const page = parseMarketplaceFeedPage(pageRaw)

  return (
    <main className="flex-1">
      <Suspense fallback={<FeedPageFallback activeTab={activeTab} />}>
        <FeedPageData brandSlug={brandSlug} activeTab={activeTab} page={page} />
      </Suspense>
    </main>
  )
}
