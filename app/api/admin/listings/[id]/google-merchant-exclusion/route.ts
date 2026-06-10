import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { setListingGoogleMerchantExclusion } from "@/lib/services/listingGoogleMerchantExclusion"
import { syncListingToGoogleMerchant } from "@/lib/services/googleMerchantSync"
import { listingGoogleMerchantExclusionBodySchema } from "@/lib/validations/listing-google-merchant-exclusion"

/**
 * Admin-only: exclude or restore a surfboard listing in the Google Merchant feed.
 * PATCH /api/admin/listings/{id}/google-merchant-exclusion
 * Body: { "excluded_from_google_merchant": true | false }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id: listingId } = await context.params
  if (!listingId?.trim()) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = listingGoogleMerchantExclusionBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await setListingGoogleMerchantExclusion({
    listingId: listingId.trim(),
    excluded: parsed.data.excluded_from_google_merchant,
  })

  if (!result.ok) {
    const status = result.message === "Listing not found" ? 404 : 500
    return NextResponse.json({ error: result.message }, { status })
  }

  let sync:
    | { action: string; offerId: string; error?: string }
    | { action: "skipped"; offerId: string }
    | null = null

  try {
    const serviceSupabase = createServiceRoleClient()
    const syncResult = await syncListingToGoogleMerchant(serviceSupabase, listingId.trim())
    sync =
      syncResult.action === "error"
        ? { action: syncResult.action, offerId: syncResult.offerId, error: syncResult.error }
        : { action: syncResult.action, offerId: syncResult.offerId }
  } catch {
    // GMC optional in local dev; DB flag still persisted.
  }

  return NextResponse.json({
    success: true,
    excluded_from_google_merchant: parsed.data.excluded_from_google_merchant,
    sync,
  })
}
