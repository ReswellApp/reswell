import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  attachListingAsShopOwnedInventory,
  attachListingAsShopOwnedInventoryBySlug,
} from "@/lib/services/shopOwnedListing"
import { attachShopOwnedListingSchema } from "@/lib/validations/consignment"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = attachShopOwnedListingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  const result = parsed.data.storeId
    ? await attachListingAsShopOwnedInventory(user.id, {
        listingId: parsed.data.listingId,
        storeId: parsed.data.storeId,
      })
    : await attachListingAsShopOwnedInventoryBySlug(user.id, {
        listingId: parsed.data.listingId,
        storeSlug: parsed.data.storeSlug!,
      })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: { listingId: result.listingId } })
}
