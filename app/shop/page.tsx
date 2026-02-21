import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ShopifyProducts } from "@/components/shopify-products"
import { MarketplaceNewGrid } from "@/components/marketplace-new-grid"
import { createClient } from "@/lib/supabase/server"

export default async function ShopPage() {
  const supabase = await createClient()

  // Marketplace new listings (section=new with inventory) — purchasable in-app
  const { data: newListings } = await supabase
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
    .order("created_at", { ascending: false })
    .limit(24)

  const marketplaceItems =
    newListings
      ?.filter((l) => {
        const inv = Array.isArray(l.inventory) ? l.inventory[0] : l.inventory
        return inv && Number((inv as { quantity: number }).quantity) > 0
      })
      .map((l) => {
        const inv = Array.isArray(l.inventory) ? l.inventory[0] : l.inventory
        const quantity = inv ? Number((inv as { quantity: number }).quantity) : 0
        const images = (l.listing_images as { url: string; is_primary: boolean }[]) || []
        const primary = images.find((i) => i.is_primary) || images[0]
        return {
          id: l.id,
          title: l.title,
          price: Number(l.price),
          image_url: primary?.url ?? null,
          stock_quantity: quantity,
        }
      }) ?? []

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-offwhite py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold text-balance">New Gear from Verified Brands</h1>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-pretty">
              Shop products directly from verified surf brands and retailers, or buy marketplace new gear with checkout here.
            </p>
          </div>
        </section>

        {/* Marketplace New (in-app checkout) */}
        {marketplaceItems.length > 0 && (
          <section className="py-8 border-b">
            <div className="container mx-auto px-4">
              <h2 className="text-xl font-bold mb-6">Marketplace New — Buy here</h2>
              <MarketplaceNewGrid items={marketplaceItems} />
            </div>
          </section>
        )}

        {/* Brand Products (external Shopify) */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <h2 className="text-xl font-bold mb-6">Brand products</h2>
            <ShopifyProducts />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
