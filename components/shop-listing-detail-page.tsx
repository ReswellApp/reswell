import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
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

  const inv = Array.isArray(listing.inventory) ? listing.inventory[0] : listing.inventory
  const stockQuantity = inv ? Number((inv as { quantity: number }).quantity) : 0
  const images = (listing.listing_images as { url: string; is_primary: boolean }[]) || []
  const primaryImage = images.find((i) => i.is_primary) || images[0]
  const imageUrl = primaryImage?.url ?? null
  const price = Number(listing.price)

  const relatedListings = await getCachedShopRelatedListings(listing.id)

  const listingCat = listing.categories as { name?: string | null } | { name?: string | null }[] | null | undefined
  const listingCatRow = Array.isArray(listingCat) ? listingCat[0] : listingCat
  const listingCategoryLabel = listingCatRow?.name?.trim()
    ? formatCategory(listingCatRow.name)
    : null

  const relatedItems =
    relatedListings
      ?.filter((l) => {
        const invRel = Array.isArray(l.inventory) ? l.inventory[0] : l.inventory
        return invRel && Number((invRel as { quantity: number }).quantity) > 0
      })
      .map((l) => {
        const invRel = Array.isArray(l.inventory) ? l.inventory[0] : l.inventory
        const qty = invRel ? Number((invRel as { quantity: number }).quantity) : 0
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
    <main className="flex-1 py-8">
      <div className="container mx-auto">
        <div className="border-t border-neutral-200 mb-6 pt-4">
          <Breadcrumb>
            <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                  <Link href="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
              {listingCategoryLabel ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/shop">Shop</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <span className="font-normal text-[#5c6b89]">{listingCategoryLabel}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">
                      {listing.title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                      <Link href="/shop">Shop</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">
                      {listing.title}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="grid max-w-5xl mx-auto lg:grid-cols-2 gap-8">
          <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
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

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">{listing.title}</h1>
              <p className="text-3xl font-bold text-black dark:text-white mt-3">
                ${price.toFixed(2)}
              </p>
            </div>

            <div>
              {stockQuantity > 10 ? (
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-900">
                  In Stock
                </Badge>
              ) : stockQuantity > 0 ? (
                <Badge variant="secondary" className="bg-neutral-200 text-neutral-800">
                  Only {stockQuantity} left
                </Badge>
              ) : (
                <Badge variant="destructive">Out of Stock</Badge>
              )}
            </div>

            <Separator />

            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {listing.description || "No description available."}
              </p>
            </div>

            {stockQuantity > 0 && (
              <Card className="bg-offwhite">
                <CardContent className="p-4 space-y-4">
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
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Free Shipping</p>
                  <p className="text-muted-foreground">On orders over $50</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Fast Delivery</p>
                  <p className="text-muted-foreground">2-5 business days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Easy Returns</p>
                  <p className="text-muted-foreground">30-day return policy</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Secure Payment</p>
                  <p className="text-muted-foreground">SSL encrypted</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {relatedItems.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-6">You May Also Like</h2>
            <MarketplaceNewGrid items={relatedItems} />
          </section>
        )}
      </div>
    </main>
  )
}
