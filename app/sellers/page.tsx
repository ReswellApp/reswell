import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Store, Users } from "lucide-react"
import { SellersBreadcrumbs } from "@/components/sellers/sellers-breadcrumbs"
import { SellersPageSellCta } from "@/components/sellers/sellers-page-sell-cta"
import { SellersDirectoryAdminBar } from "@/components/sellers/sellers-directory-admin-bar"
import { SellersDirectorySearch } from "@/components/sellers/sellers-directory-search"
import { SellersDirectoryGrid } from "@/components/sellers/sellers-directory-grid"
import {
  filterSellersDirectoryCatalog,
  getCachedSellersDirectoryCatalog,
} from "@/lib/cache/sellers-directory-catalog"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 3600

export async function generateMetadata() {
  return resolvePageMetadata("sellers")
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const authClient = await createClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  const catalog = filterSellersDirectoryCatalog(await getCachedSellersDirectoryCatalog(), q)
  const { items: catalogItems, totalInventory } = catalog
  const orderedSellerIds = catalogItems.map((item) => item.shop.id)

  const { data: followRows } =
    user && orderedSellerIds.length > 0
      ? await authClient
          .from("seller_follows")
          .select("seller_id")
          .eq("follower_id", user.id)
          .in("seller_id", orderedSellerIds)
      : { data: [] as { seller_id: string }[] }

  const followingSet = new Set((followRows ?? []).map((row) => row.seller_id))

  const gridItems = catalogItems.map((item) => ({
    shop: item.shop,
    thumbs: item.thumbs,
    tileMeta: item.tileMeta,
    avgRating: item.avgRating,
    reviewCount: item.reviewCount,
    avatarSrc: item.avatarSrc,
    mosaicSlots: item.mosaicSlots,
    initialFollowing: followingSet.has(item.shop.id),
    isOwnProfile: user?.id === item.shop.id,
  }))

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
            {catalogItems.length > 0 ? (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {catalogItems.length} seller{catalogItems.length !== 1 ? "s" : ""}
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
                {catalogItems.length} seller{catalogItems.length !== 1 ? "s" : ""} found for “{q}”
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sellers">Clear search</Link>
              </Button>
            </div>
          ) : null}

          {catalogItems.length === 0 ? (
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
