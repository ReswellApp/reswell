import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminRelatedContentSearchQuerySchema } from "@/lib/validations/listing-related-content"
import { searchRelatedContentPickerService } from "@/lib/services/listingRelatedContent"

export async function GET(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = adminRelatedContentSearchQuerySchema.safeParse({
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    host_listing_id: request.nextUrl.searchParams.get("host_listing_id") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid search"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await searchRelatedContentPickerService({
    type: parsed.data.type,
    query: parsed.data.q,
    hostListingId: parsed.data.host_listing_id,
    limit: parsed.data.limit,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { listings: result.listings ?? [], blogs: result.blogs ?? [] } }, { status: 200 })
}
