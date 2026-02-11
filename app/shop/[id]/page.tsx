import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, Package, Truck, Shield, RotateCcw } from "lucide-react"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { QuantitySelector } from "@/components/quantity-selector"

export default async function ProductPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  
  const { data: product } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", params.id)
    .eq("is_active", true)
    .single()

  if (!product) {
    notFound()
  }

  // Get related products
  const { data: relatedProducts } = await supabase
    .from("inventory")
    .select("*")
    .eq("category", product.category)
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .neq("id", product.id)
    .limit(4)

  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price
  const discountPercent = hasDiscount
    ? Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)
    : 0

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/shop" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Shop
            </Link>
            {product.category && (
              <>
                <span>/</span>
                <Link
                  href={`/shop?category=${product.category}`}
                  className="hover:text-foreground capitalize"
                >
                  {product.category.replace("-", " ")}
                </Link>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Product Image */}
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
              {product.image_url ? (
                <Image
                  src={product.image_url || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
              {hasDiscount && (
                <Badge className="absolute top-4 left-4 bg-accent text-accent-foreground text-lg px-3 py-1">
                  -{discountPercent}% OFF
                </Badge>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold">{product.name}</h1>
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-3xl font-bold text-primary">
                    ${product.price.toFixed(2)}
                  </p>
                  {hasDiscount && (
                    <p className="text-xl text-muted-foreground line-through">
                      ${product.compare_at_price.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stock Status */}
              <div>
                {product.stock_quantity > 10 ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    In Stock
                  </Badge>
                ) : product.stock_quantity > 0 ? (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    Only {product.stock_quantity} left
                  </Badge>
                ) : (
                  <Badge variant="destructive">Out of Stock</Badge>
                )}
              </div>

              <Separator />

              {/* Description */}
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {product.description || "No description available."}
                </p>
              </div>

              {/* Add to Cart */}
              {product.stock_quantity > 0 && (
                <Card className="bg-secondary/30">
                  <CardContent className="p-4 space-y-4">
                    <QuantitySelector
                      productId={product.id}
                      maxQuantity={product.stock_quantity}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Features */}
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

          {/* Related Products */}
          {relatedProducts && relatedProducts.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-bold mb-6">You May Also Like</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <Link key={item.id} href={`/shop/${item.id}`}>
                    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="aspect-square relative bg-muted">
                        {item.image_url ? (
                          <Image
                            src={item.image_url || "/placeholder.svg"}
                            alt={item.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-medium line-clamp-1">{item.name}</h3>
                        <p className="text-lg font-bold text-primary mt-1">
                          ${item.price.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
