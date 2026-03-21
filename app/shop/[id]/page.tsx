import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, Package, Truck, Shield, RotateCcw } from "lucide-react"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { QuantitySelector } from "@/components/quantity-selector"
import { MarketplaceNewGrid } from "@/components/marketplace-new-grid"

export default async function ProductPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()

  // Treat id as listing id — marketplace new item
  const { data: listing } = await supabase
    .from("listings")
    .select(`
      id,
      title,
      description,
      price,
      user_id,
      listing_images (url, is_primary),
      inventory (quantity)
    `)
    .eq("id", params.id)
    .eq("section", "new")
    .eq("status", "active")
    .single()

  if (!listing) {
    notFound()
  }

  const inv = Array.isArray(listing.inventory) ? listing.inventory[0] : listing.inventory
  const stockQuantity = inv ? Number((inv as { quantity: number }).quantity) : 0
  const images = (listing.listing_images as { url: string; is_primary: boolean }[]) || []
  const primaryImage = images.find((i) => i.is_primary) || images[0]
  const imageUrl = primaryImage?.url ?? null
  const price = Number(listing.price)

  // Related: other new listings with stock (same seller or any)
  const { data: relatedListings } = await supabase
    .from("listings")
    .select(`
      id,
      title,
      price,
      listing_images (url, is_primary),
      inventory (quantity)
    `)
    .eq("section", "new")
    .eq("status", "active")
    .neq("id", listing.id)
    .order("created_at", { ascending: false })
    .limit(4)

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
        return {
          id: l.id,
          title: l.title,
          price: Number(l.price),
          image_url: prim?.url ?? null,
          stock_quantity: qty,
        }
      })
      .slice(0, 4) ?? []

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/shop" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Shop
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={listing.title}
                  fill
                  className="object-contain"
                  style={{ objectFit: "contain" }}
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
                <p className="text-3xl font-bold text-primary mt-3">
                  ${price.toFixed(2)}
                </p>
              </div>

              <div>
                {stockQuantity > 10 ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    In Stock
                  </Badge>
                ) : stockQuantity > 0 ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
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

      <Footer />
    </div>
  )
}
