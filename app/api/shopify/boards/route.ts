import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getShopifyProducts } from "@/lib/shopify"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") || ""
  const boardType = searchParams.get("type") || ""
  const sortKey = searchParams.get("sort") || "RELEVANCE"
  const reverse = searchParams.get("reverse") === "true"

  const supabase = await createClient()

  try {
    // Fetch verified sellers with Shopify connected, include shop location info
    const { data: sellers, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, shop_name, shopify_domain, shop_verified, avatar_url, sales_count, shop_address, city, location"
      )
      .eq("is_shop", true)
      .eq("shop_verified", true)
      .not("shopify_domain", "is", null)
      .order("sales_count", { ascending: false })

    if (error || !sellers || sellers.length === 0) {
      return NextResponse.json({ products: [], sellers: [] })
    }

    // Build a Shopify search query that targets surfboard-related products
    // We combine the user's search with a product-type filter
    const surfboardKeywords = "surfboard OR board OR surf"
    const searchQuery = query
      ? `(${query}) AND (${surfboardKeywords})`
      : surfboardKeywords

    // Fetch from all sellers in parallel
    const allProductResults = await Promise.allSettled(
      sellers.map(async (seller) => {
        try {
          const products = await getShopifyProducts({
            storeDomain: seller.shopify_domain!,
            searchQuery,
            sortKey: sortKey as
              | "RELEVANCE"
              | "TITLE"
              | "CREATED_AT"
              | "PRICE"
              | "BEST_SELLING",
            reverse,
            first: 20,
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
              shop_address: seller.shop_address,
              city: seller.city,
              location: seller.location,
            },
          }))
        } catch {
          return []
        }
      })
    )

    const allProducts = allProductResults
      .filter(
        (r): r is PromiseFulfilledResult<ReturnType<typeof Array<Record<string, unknown>>>> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value as Array<Record<string, unknown>>)

    return NextResponse.json({
      products: allProducts,
      sellers,
    })
  } catch (err) {
    console.error("Shopify boards API error:", err)
    return NextResponse.json({ products: [], sellers: [] }, { status: 500 })
  }
}
