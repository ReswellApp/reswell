import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getActiveShopifyConnectionForUser, markShopifyConnectionSync } from "@/lib/db/shopify-connections"
import { fetchShopifyProduct } from "@/lib/shopify/admin-api"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import {
  importShopifyProductAllVariants,
  syncShopifyVariantToListing,
} from "@/lib/services/shopifySync"
import { shopifyBulkImportBodySchema, shopifyImportBodySchema } from "@/lib/validations/shopify"

/**
 * POST /api/integrations/shopify/import
 * Import one or more Shopify products (all variants or selected variants).
 */
export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const singleParsed = shopifyImportBodySchema.safeParse(body)
  const bulkParsed = !singleParsed.success ? shopifyBulkImportBodySchema.safeParse(body) : null

  if (!singleParsed.success && !bulkParsed?.success) {
    return NextResponse.json({ error: "Invalid import payload" }, { status: 400 })
  }

  const connection = await getActiveShopifyConnectionForUser(supabase, user.id)
  if (!connection) {
    return NextResponse.json({ error: "Connect a Shopify store first" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const results: Array<{
    productId: string
    variantId: string
    ok: boolean
    listingId?: string
    action?: string
    error?: string
    unmapped?: boolean
  }> = []

  if (singleParsed.success) {
    const { productId, variantIds, section } = singleParsed.data
    const product = await fetchShopifyProduct({
      shopDomain: connection.shop_domain,
      accessToken: connection.access_token,
      productId,
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found in Shopify" }, { status: 404 })
    }

    const targets =
      variantIds && variantIds.length > 0
        ? product.variants.filter((v) => variantIds.includes(String(v.id)))
        : product.variants

    for (const variant of targets) {
      const result = await syncShopifyVariantToListing({
        supabase,
        serviceSupabase,
        connection,
        productId: String(product.id),
        variantId: String(variant.id),
        sectionOverride: section ?? null,
        replaceImages: true,
      })
      results.push({
        productId: String(product.id),
        variantId: String(variant.id),
        ok: result.ok,
        listingId: result.ok ? result.listingId : undefined,
        action: result.ok ? result.action : undefined,
        error: result.ok ? undefined : result.error,
        unmapped: result.ok ? undefined : result.unmapped,
      })
    }
  } else if (bulkParsed?.success) {
    for (const productId of bulkParsed.data.productIds) {
      const variantResults = await importShopifyProductAllVariants({
        supabase,
        serviceSupabase,
        connection,
        productId,
        sectionOverride: bulkParsed.data.section ?? null,
      })
      for (const row of variantResults) {
        results.push({
          productId,
          variantId: row.variantId,
          ok: row.ok,
          listingId: row.ok ? row.listingId : undefined,
          action: row.ok ? row.action : undefined,
          error: row.ok ? undefined : row.error,
          unmapped: row.ok ? undefined : row.unmapped,
        })
      }
    }
  }

  const failed = results.filter((r) => !r.ok)
  await markShopifyConnectionSync(
    serviceSupabase,
    connection.id,
    failed.length > 0 ? `${failed.length} variant(s) failed to import` : null,
  )

  return NextResponse.json({
    data: {
      imported: results.filter((r) => r.ok).length,
      failed: failed.length,
      results,
    },
  })
}
