import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveShopifyConnectionForUser } from "@/lib/db/shopify-connections"
import { listShopifySectionMappingsForUser } from "@/lib/db/shopify-section-mappings"
import { listShopifyLinksForUser } from "@/lib/db/shopify-product-links"
import { listShopifyProducts } from "@/lib/shopify/admin-api"
import { resolveShopifyProductSection } from "@/lib/shopify/map-product-to-section"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import type { ShopifyRestProduct } from "@/lib/shopify/types"

export type ShopifyProductPreview = {
  id: string
  title: string
  productType: string
  vendor: string
  tags: string[]
  imageUrl: string | null
  variantCount: number
  detectedSection: string | null
  linkedVariantIds: string[]
  updatedAt: string
}

function toPreview(
  product: ShopifyRestProduct,
  mappings: Awaited<ReturnType<typeof listShopifySectionMappingsForUser>>,
  linkedVariantIds: string[],
): ShopifyProductPreview {
  const section = resolveShopifyProductSection({ product, mappings })
  const tags = (product.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)

  return {
    id: String(product.id),
    title: product.title,
    productType: product.product_type ?? "",
    vendor: product.vendor ?? "",
    tags,
    imageUrl: product.images?.[0]?.src ?? null,
    variantCount: product.variants?.length ?? 0,
    detectedSection: section,
    linkedVariantIds,
    updatedAt: product.updated_at,
  }
}

/**
 * GET /api/integrations/shopify/products?page_info=...
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await checkShopifyConnectAccess(supabase, user.id)
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const connection = await getActiveShopifyConnectionForUser(supabase, user.id)
  if (!connection) {
    return NextResponse.json({ error: "Connect a Shopify store first" }, { status: 400 })
  }

  const pageInfo = request.nextUrl.searchParams.get("page_info")

  const [{ products, nextPageInfo }, mappings, links] = await Promise.all([
    listShopifyProducts({
      shopDomain: connection.shop_domain,
      accessToken: connection.access_token,
      pageInfo,
    }),
    listShopifySectionMappingsForUser(supabase, user.id, connection.id),
    listShopifyLinksForUser(supabase, user.id),
  ])

  const linksByProduct = new Map<string, string[]>()
  for (const link of links) {
    const arr = linksByProduct.get(link.shopify_product_id) ?? []
    arr.push(link.shopify_variant_id)
    linksByProduct.set(link.shopify_product_id, arr)
  }

  const previews = products.map((product) =>
    toPreview(product, mappings, linksByProduct.get(String(product.id)) ?? []),
  )

  return NextResponse.json({
    data: {
      products: previews,
      nextPageInfo,
    },
  })
}
