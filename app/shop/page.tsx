import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ShopifyProducts } from "@/components/shopify-products"

export default function ShopPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-accent/10 to-background py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold text-balance">New Gear from Verified Brands</h1>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-pretty">
              Shop products directly from verified surf brands and retailers. All items are fulfilled through the seller's own store.
            </p>
          </div>
        </section>

        {/* Brand Products */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <ShopifyProducts />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
