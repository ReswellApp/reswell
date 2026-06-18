import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getListingVariants } from "@/lib/db/listing-variants"

export const dynamic = "force-dynamic"

/**
 * GET /api/listings/[id]/variants
 * Public variant options for a listing (browse / checkout picker).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing listing id" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from("listings")
    .select("id, has_variants, status, hidden_from_site, archived_at")
    .eq("id", id.trim())
    .maybeSingle()

  if (!listing || listing.hidden_from_site || listing.archived_at) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  if (!listing.has_variants) {
    return NextResponse.json({ data: { variants: [] } })
  }

  const variants = await getListingVariants(supabase, listing.id)
  const publicVariants = variants.map((v) => ({
    id: v.id,
    title: v.title,
    option1: v.option1,
    option2: v.option2,
    option3: v.option3,
    price: v.price,
    in_stock: v.in_stock,
    available: Math.max(0, v.stock_quantity - v.reserved_quantity),
    image_url: v.image_url,
  }))

  return NextResponse.json({ data: { variants: publicVariants } })
}
