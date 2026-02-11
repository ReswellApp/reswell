import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getShopifyProducts } from "@/lib/shopify"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sellerId = searchParams.get("seller_id")
  const query = searchParams.get("q") || ""
  const sortKey = searchParams.get("sort") || "RELEVANCE"
  const reverse = searchParams.get("reverse") === "true"

  const supabase = await createClient()

  try {
    // If a specific seller is requested, fetch only their Shopify products
    if (sellerId) {
      const { data: seller, error } = await supabase
        .from("profiles")
        .select("id, display_name, shop_name, shopify_domain, shop_verified, avatar_url")
        .eq("id", sellerId)
        .eq("is_shop", true)
        .eq("shop_verified", true)
        .not("shopify_domain", "is", null)
        .single()

      if (error || !seller?.shopify_domain) {
        return NextResponse.json({ products: [], sellers: [] })
      }

      const products = await getShopifyProducts({
        storeDomain: seller.shopify_domain,
        searchQuery: query || undefined,
        sortKey: sortKey as "RELEVANCE" | "TITLE" | "CREATED_AT" | "PRICE" | "BEST_SELLING",
        reverse,
      })

      // Tag each product with the seller info
      const taggedProducts = products.map((p) => ({
        ...p,
        seller: {
          id: seller.id,
          name: seller.shop_name || seller.display_name,
          verified: seller.shop_verified,
          avatar_url: seller.avatar_url,
          shopify_domain: seller.shopify_domain,
        },
      }))

      return NextResponse.json({ products: taggedProducts, sellers: [seller] })
    }

    // Otherwise, fetch products from ALL connected sellers, ordered by sales_count
    const { data: sellers, error } = await supabase
      .from("profiles")
      .select("id, display_name, shop_name, shopify_domain, shop_verified, avatar_url, sales_count")
      .eq("is_shop", true)
      .eq("shop_verified", true)
      .not("shopify_domain", "is", null)
      .order("sales_count", { ascending: false })

    if (error || !sellers || sellers.length === 0) {
      return NextResponse.json({ products: [], sellers: [] })
    }

    // Fetch products from each seller's Shopify store in parallel
    const allProductResults = await Promise.allSettled(
      sellers.map(async (seller) => {
        try {
          const products = await getShopifyProducts({
            storeDomain: seller.shopify_domain!,
            searchQuery: query || undefined,
            sortKey: sortKey as "RELEVANCE" | "TITLE" | "CREATED_AT" | "PRICE" | "BEST_SELLING",
            reverse,
          })
          return products.map((p) => ({
            ...p,
            seller: {
              id: seller.id,
              name: seller.shop_name || seller.display_name,
              verified: seller.shop_verified,
              avatar_url: seller.avatar_url,
              shopify_domain: seller.shopify_domain,
              sales_count: seller.sales_count ?? 0,
            },
          }))
        } catch {
          // If a seller's Shopify store is unreachable, skip
          return []
        }
      })
    )

    const allProducts = allProductResults
      .filter(
        (r): r is PromiseFulfilledResult<typeof allProductResults extends Promise<infer T>[] ? T : never> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value as Array<Record<string, unknown>>)

    return NextResponse.json({
      products: allProducts,
      sellers: sellers,
    })
  } catch (err) {
    console.error("Shopify products API error:", err)
    return NextResponse.json({ products: [], sellers: [] }, { status: 500 })
  }
}
