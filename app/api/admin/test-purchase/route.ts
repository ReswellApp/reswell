import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  createAdminTestPurchase,
  previewAdminTestPurchaseListing,
} from "@/lib/services/adminTestPurchase"
import {
  adminTestPurchaseBodySchema,
  adminTestPurchaseListingPreviewSchema,
} from "@/lib/validations/adminTestPurchase"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/test-purchase?listing_ref=…
 * Preview a listing before seeding a test purchase.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = adminTestPurchaseListingPreviewSchema.safeParse({
    listing_ref: request.nextUrl.searchParams.get("listing_ref") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing reference" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const result = await previewAdminTestPurchaseListing(serviceSupabase, parsed.data.listing_ref)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.preview })
}

/**
 * POST /api/admin/test-purchase
 * Seed a confirmed order without Stripe or wallet charges (Google Ads / success-page QA).
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = adminTestPurchaseBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const result = await createAdminTestPurchase(serviceSupabase, {
    buyerId: gate.ctx.user.id,
    buyerEmail: gate.ctx.user.email ?? null,
    listingRef: parsed.data.listing_ref,
    fulfillment: parsed.data.fulfillment,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: {
      orderId: result.orderId,
      successPagePath: result.successPagePath,
      amount: result.amount,
      fulfillmentMethod: result.fulfillmentMethod,
    },
  })
}
