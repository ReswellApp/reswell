import Link from "next/link"
import Image from "next/image"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { MapPin, Store, ArrowRight } from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardClassName } from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"
import { wideShimmer } from "@/lib/image-shimmer"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { sellerProfileHref } from "@/lib/seller-slug"
import { SellersPageSellCta } from "@/components/sellers/sellers-page-sell-cta"
import { pageSeoMetadata } from "@/lib/site-metadata"

const PLACEHOLDER_IMAGE = "/placeholder.svg"
const THUMB_PER_SELLER = 6
const LISTINGS_FETCH_CAP = 4000

export const metadata = pageSeoMetadata({
  title: "Surf sellers — Reswell",
  description:
    "Browse local surf sellers on Reswell — shop profiles, verified shops, and peer listings near you.",
  path: "/sellers",
})

type ListingThumb = {
  id: string
  user_id: string
  title: string
  price: number | string | null
  slug: string | null
  section: string
  created_at: string
  listing_images: { url: string; thumbnail_url?: string | null; is_primary?: boolean | null }[] | null
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

  const [{ data: shopRows, error: shopIdsError }, { data: listingRows, error: listingIdsError }] =
    await Promise.all([
      supabase.from("profiles").select("id").eq("is_shop", true),
      supabase
        .from("listings")
        .select("user_id")
        .eq("status", "active")
        .eq("hidden_from_site", false)
        .is("archived_at", null),
    ])

  if (shopIdsError) console.error("[sellers] profiles (is_shop) ids:", shopIdsError)
  if (listingIdsError) console.error("[sellers] listings seller ids:", listingIdsError)

  const sellerIdSet = new Set<string>()
  for (const row of shopRows ?? []) sellerIdSet.add(row.id)
  for (const row of listingRows ?? []) sellerIdSet.add(row.user_id)
  const sellerIds = [...sellerIdSet]

  const shops =
    sellerIds.length === 0
      ? []
      : await (async () => {
          let query = supabase
            .from("profiles")
            .select(profilePublicFields)
            .in("id", sellerIds)
            .order("sales_count", { ascending: false })
            .order("shop_verified", { ascending: false })
            .order("created_at", { ascending: false })

          if (q) {
            query = query.or(
              `shop_name.ilike.%${q}%,shop_description.ilike.%${q}%,display_name.ilike.%${q}%,city.ilike.%${q}%,shop_address.ilike.%${q}%`
            )
          }

          const { data, error } = await query
          if (error) {
            console.error("[sellers] profiles fetch:", error)
            return []
          }
          return data ?? []
        })()

  /** Up to THUMB_PER_SELLER most recent active listings per seller (by global recency pass). */
  const thumbsBySeller = new Map<string, ListingThumb[]>()
  if (shops.length > 0 && sellerIds.length > 0) {
    const { data: invRows, error: invError } = await supabase
      .from("listings")
      .select(
        "id, user_id, title, price, slug, section, created_at, listing_images (url, thumbnail_url, is_primary)"
      )
      .in(
        "user_id",
        shops.map((s) => s.id)
      )
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(LISTINGS_FETCH_CAP)

    if (invError) {
      console.error("[sellers] inventory thumbnails:", invError)
    } else {
      for (const row of (invRows ?? []) as ListingThumb[]) {
        const cur = thumbsBySeller.get(row.user_id) ?? []
        if (cur.length >= THUMB_PER_SELLER) continue
        cur.push(row)
        thumbsBySeller.set(row.user_id, cur)
      }
    }
  }

  return (
    <main className="flex-1">
      <section className="border-b border-border/60 bg-offwhite py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Store className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-balance">
              Sellers
            </h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty sm:text-base">
              Browse seller profiles and a sample of what they have listed right now.
            </p>
            <SiteSearchBar
              action="/sellers"
              method="GET"
              className="mx-auto mt-6 w-full max-w-lg"
            >
              <Input
                name="q"
                defaultValue={q || ""}
                placeholder="Search by name or location…"
                className={siteSearchInputClassName()}
              />
            </SiteSearchBar>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container mx-auto px-4">
          {q ? (
            <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {shops?.length || 0} seller{shops?.length !== 1 ? "s" : ""} found
                {q ? ` for “${q}”` : ""}
              </p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sellers">Clear</Link>
              </Button>
            </div>
          ) : null}

          {!shops || shops.length === 0 ? (
            <div className="mx-auto max-w-md py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Store className="h-7 w-7 text-muted-foreground" aria-hidden />
              </div>
              <h2 className="text-lg font-semibold text-foreground">No sellers found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {q ? "Try different search terms." : "Check back soon as more sellers join Reswell."}
              </p>
              {!q ? (
                <Button className="mt-6" asChild>
                  <Link href="/auth/sign-up">Join Reswell</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {shops.map((shop) => {
                const label = shop.shop_name?.trim() || shop.display_name || "Seller"
                const thumbs = thumbsBySeller.get(shop.id) ?? []
                return (
                  <Card
                    key={shop.id}
                    className={cn(listingProductCardClassName, "overflow-hidden border-border/80")}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <Link
                          href={sellerProfileHref(shop)}
                          className="flex min-w-0 flex-1 gap-3 rounded-lg outline-none ring-offset-background transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Avatar className="h-14 w-14 shrink-0 border border-border">
                            <AvatarImage src={shop.shop_logo_url || shop.avatar_url || ""} alt="" />
                            <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                              {label.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground">{label}</span>
                              {shop.shop_verified ? <VerifiedBadge size="md" /> : null}
                            </div>
                            {(shop.city || shop.shop_address) && (
                              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="truncate">{shop.shop_address || shop.city}</span>
                              </p>
                            )}
                            {shop.shop_description ? (
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                {shop.shop_description}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                        <Button variant="outline" size="sm" className="shrink-0 self-start" asChild>
                          <Link href={sellerProfileHref(shop)}>
                            Profile
                            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      </div>

                      {thumbs.length > 0 ? (
                        <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
                          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Inventory
                          </p>
                          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {thumbs.map((listing) => {
                              const href = listingDetailHref(listing)
                              const src =
                                listingCardImageSrc(listing.listing_images) || PLACEHOLDER_IMAGE
                              const price =
                                listing.price != null && listing.price !== ""
                                  ? Number(listing.price).toFixed(0)
                                  : null
                              return (
                                <li key={listing.id} className="min-w-0">
                                  <Link
                                    href={href}
                                    className="group block overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm transition hover:border-primary/30 hover:shadow-md"
                                  >
                                    <div className="relative aspect-square w-full bg-muted">
                                      <Image
                                        src={src}
                                        alt={listing.title}
                                        fill
                                        sizes="(max-width: 640px) 33vw, 120px"
                                        className="object-cover transition group-hover:scale-[1.03]"
                                        placeholder="blur"
                                        blurDataURL={wideShimmer}
                                      />
                                    </div>
                                    {price ? (
                                      <p className="truncate px-1.5 py-1 text-center text-[11px] font-semibold text-foreground">
                                        ${price}
                                      </p>
                                    ) : (
                                      <p className="truncate px-1.5 py-1 text-center text-[11px] text-muted-foreground">
                                        View
                                      </p>
                                    )}
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : (
                        <div className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">
                          No active listings right now.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
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
