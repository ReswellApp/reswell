import { MarketplaceNewGrid } from "@/components/marketplace-new-grid"
import { createClient } from "@/lib/supabase/server"
import { formatCategory } from "@/lib/listing-labels"

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
      inventory (quantity),
      categories (name)
    `)
    .eq("section", "new")
    .eq("status", "active")
    .eq("hidden_from_site", false)
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
        const cat = l.categories as { name?: string | null } | { name?: string | null }[] | null | undefined
        const catRow = Array.isArray(cat) ? cat[0] : cat
        const categoryLabel = catRow?.name?.trim() ? formatCategory(catRow.name) : null
        return {
          id: l.id,
          title: l.title,
          price: Number(l.price),
          image_url: primary?.url ?? null,
          stock_quantity: quantity,
          categoryLabel,
        }
      }) ?? []

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="bg-offwhite py-12">
        <div className="container mx-auto text-center">
          <h1 className="text-3xl font-bold text-balance">New Gear</h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto text-pretty">
            Buy new surf gear with checkout on Reswell when sellers list marketplace new inventory.
          </p>
        </div>
      </section>

      {/* Marketplace New (in-app checkout) */}
      {marketplaceItems.length > 0 && (
        <section className="py-8 border-b">
          <div className="container mx-auto">
            <h2 className="text-xl font-bold mb-6">Marketplace New — Buy here</h2>
            <MarketplaceNewGrid items={marketplaceItems} />
          </div>
        </section>
      )}
    </main>
  )
}
