import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getActiveShopifyConnectionForUser, markShopifyConnectionSync } from "@/lib/db/shopify-connections"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import { syncShopifyProductToListing } from "@/lib/services/shopifyProductSync"
import { shopifyBulkImportBodySchema, shopifyImportBodySchema } from "@/lib/validations/shopify"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

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

  const productIds: string[] = singleParsed.success
    ? [singleParsed.data.productId]
    : (bulkParsed?.data?.productIds ?? [])
  const sectionOverride: PeerListingSection | null = singleParsed.success
    ? (singleParsed.data.section ?? null)
    : (bulkParsed?.data?.section ?? null)

  const results: Array<{
    productId: string
    ok: boolean
    listingId?: string
    action?: string
    variantCount?: number
    error?: string
    unmapped?: boolean
  }> = []

  for (const productId of productIds) {
    const result = await syncShopifyProductToListing({
      serviceSupabase,
      connection,
      productId,
      sectionOverride,
      replaceImages: true,
    })
    results.push({
      productId,
      ok: result.ok,
      listingId: result.ok ? result.listingId : undefined,
      action: result.ok ? result.action : undefined,
      variantCount: result.ok ? result.variantCount : undefined,
      error: result.ok ? undefined : result.error,
      unmapped: result.ok ? undefined : result.unmapped,
    })
  }

  const failed = results.filter((r) => !r.ok)
  await markShopifyConnectionSync(
    serviceSupabase,
    connection.id,
    failed.length > 0 ? `${failed.length} product(s) failed to import` : null,
  )

  return NextResponse.json({
    data: {
      imported: results.filter((r) => r.ok).length,
      failed: failed.length,
      results,
    },
  })
}
