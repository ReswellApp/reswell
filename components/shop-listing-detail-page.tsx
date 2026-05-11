import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { createClient } from "@/lib/supabase/server"
import {
  getCachedPublicShopListing,
  getCachedShopRelatedListings,
  SHOP_LISTING_SELECT,
} from "@/lib/listing-detail-cache"
import { Package, Truck, Shield, RotateCcw } from "lucide-react"
import { QuantitySelector } from "@/components/quantity-selector"
import { MarketplaceNewGrid } from "@/components/marketplace-new-grid"
import { formatCategory } from "@/lib/listing-labels"
import { findListingByParam } from "@/lib/listing-query"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

export async function ShopListingDetailPage({
  listingParam,
}: {
  listingParam: string
}) {
  const supabase = await createClient()

  let { listing } = await getCachedPublicShopListing(listingParam)
  if (!listing) {
    const r = await findListingByParam(supabase, listingParam, {
      select: SHOP_LISTING_SELECT,
      section: "new",
      includeHiddenListings: true,
    })
    listing = r.listing
  }

  if (!listing || listing.status !== "active") {
    notFound()
  }

  const stockQuantity = Number((listing as { stock_quantity?: number }).stock_quantity) || 0
  const images = (listing.listing_images as { url: string; is_primary: boolean }[]) || []
  const primaryImage = images.find((i) => i.is_primary) || images[0]
  const imageUrl = primaryImage?.url ? proxiedListingImageSrc(primaryImage.url) : null
  const price = Number(listing.price)

  const relatedListings = await getCachedShopRelatedListings(listing.id)

  const listingCat = listing.categories as { name?: string | null } | { name?: string | null }[] | null | undefined
  const listingCatRow = Array.isArray(listingCat) ? listingCat[0] : listingCat
  const listingCategoryLabel = listingCatRow?.name?.trim()
    ? formatCategory(listingCatRow.name)
    : null

  const relatedItems =
    relatedListings
      ?.filter((l) => Number((l as { stock_quantity?: number }).stock_quantity) > 0)
      .map((l) => {
        const qty = Number((l as { stock_quantity?: number }).stock_quantity) || 0
        const imgs = (l.listing_images as { url: string; is_primary: boolean }[]) || []
        const prim = imgs.find((i) => i.is_primary) || imgs[0]
        const cat = l.categories as { name?: string | null } | { name?: string | null }[] | null | undefined
        const catRow = Array.isArray(cat) ? cat[0] : cat
        const categoryLabel = catRow?.name?.trim() ? formatCategory(catRow.name) : null
        return {
          id: l.id,
          title: l.title,
          price: Number(l.price),
          image_url: prim?.url ?? null,
          stock_quantity: qty,
          categoryLabel,
        }
      })
      .slice(0, 4) ?? []

  return (
    <main className="relative flex-1 w-full min-w-0 max-w-full overflow-x-clip bg-background pb-16 pt-5 sm:pb-24 sm:pt-8">
      <div className="container mx-auto w-full min-w-0 max-w-full px-4 sm:px-6 lg:max-w-[1120px] lg:px-8">
        <div className="mb-5 min-w-0 max-w-full pt-0.5 lg:mb-8">
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-[13px] font-normal tracking-wide text-muted-foreground sm:gap-1.5 sm:text-[15px]">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
              {listingCategoryLabel ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                      <Link href="/shop">Shop</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <span className="font-normal text-muted-foreground">{listingCategoryLabel}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                      {listing.title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="transition-colors hover:text-foreground">
                      <Link href="/shop">Shop</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-muted-foreground/70 [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-[min(100%,28rem)] truncate font-normal text-muted-foreground">
                      {listing.title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="mx-auto grid w-full min-w-0 max-w-full gap-8 sm:max-w-6xl lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] lg:items-start lg:gap-12 xl:gap-16">
          <div className="relative min-w-0 w-full max-w-full lg:max-w-[29rem] lg:justify-self-start xl:max-w-[32rem]">
            <div className="relative aspect-square min-h-0 w-full overflow-hidden rounded-2xl bg-[#f5f5f7] shadow-sm ring-1 ring-black/[0.04] dark:bg-muted dark:ring-white/[0.06]">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={listing.title}
                  fill
                  className="object-cover object-center"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-8 lg:pt-2">
            <div className="min-w-0">
              <h1 className="font-headline text-balance break-words text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[2.125rem] lg:text-[2.25rem] xl:text-[2.375rem]">
                {listing.title}
              </h1>
              <p className="font-headline mt-4 text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl xl:text-[2.5rem]">
                ${price.toFixed(2)}
              </p>
            </div>

            <div>
              {stockQuantity > 10 ? (
                <span className="inline-flex rounded-full bg-muted/70 px-3.5 py-1 text-[15px] font-medium text-muted-foreground dark:bg-muted/50">
                  In stock
                </span>
              ) : stockQuantity > 0 ? (
                <span className="inline-flex rounded-full bg-amber-500/12 px-3.5 py-1 text-[15px] font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
                  Only {stockQuantity} left
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-destructive/12 px-3.5 py-1 text-[15px] font-medium text-destructive">
                  Out of stock
                </span>
              )}
            </div>

            <div className="h-px w-full bg-border/50" />

            <div className="min-w-0 space-y-4">
              <h2 className="font-headline text-[1.3125rem] font-semibold tracking-tight text-foreground">
                Description
              </h2>
              <p className="break-words text-[17px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                {listing.description || "No description available."}
              </p>
            </div>

            {stockQuantity > 0 && (
              <div className="rounded-3xl bg-muted/45 p-5 dark:bg-muted/20">
                  <QuantitySelector
                    productId={listing.id}
                    maxQuantity={stockQuantity}
                    item={{
                      id: listing.id,
                      name: listing.title,
                      price,
                      image_url: imageUrl,
                    }}
                  />
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-3.5 text-[15px]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-foreground shadow-sm dark:bg-background/40">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-foreground">Free shipping</p>
                  <p className="mt-0.5 text-[14px] text-muted-foreground">On orders over $50</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3.5 text-[15px]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-foreground shadow-sm dark:bg-background/40">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-foreground">Fast delivery</p>
                  <p className="mt-0.5 text-[14px] text-muted-foreground">2–5 business days</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3.5 text-[15px]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-foreground shadow-sm dark:bg-background/40">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-foreground">Easy returns</p>
                  <p className="mt-0.5 text-[14px] text-muted-foreground">30-day return policy</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3.5 text-[15px]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-foreground shadow-sm dark:bg-background/40">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="font-medium text-foreground">Secure payment</p>
                  <p className="mt-0.5 text-[14px] text-muted-foreground">SSL encrypted</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {relatedItems.length > 0 && (
          <section className="mt-20 min-w-0 max-w-full border-t border-border/40 pt-16">
            <h2 className="font-headline mb-10 text-[1.8125rem] font-semibold tracking-tight text-foreground sm:text-[1.875rem]">
              You may also like
            </h2>
            <MarketplaceNewGrid items={relatedItems} />
          </section>
        )}
      </div>
    </main>
  )
}
