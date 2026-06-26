import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  previewAdminTerminalListing,
  previewAdminTerminalListingById,
} from "@/lib/services/adminTerminalSale"
import { adminTerminalListingPreviewSchema } from "@/lib/validations/adminTerminalSale"

export const dynamic = "force-dynamic"

/** GET /api/admin/terminal/listing-preview?listing_ref=… or ?listing_id=… */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = adminTerminalListingPreviewSchema.safeParse({
    listing_ref: request.nextUrl.searchParams.get("listing_ref") ?? undefined,
    listing_id: request.nextUrl.searchParams.get("listing_id") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing reference" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const result = parsed.data.listing_id
    ? await previewAdminTerminalListingById(serviceSupabase, parsed.data.listing_id)
    : await previewAdminTerminalListing(serviceSupabase, parsed.data.listing_ref!.trim())

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: result.preview })
}
