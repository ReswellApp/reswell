import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { updateSellerListingQuickPrice } from "@/lib/services/listingQuickPrice"
import { listingQuickPriceBodySchema } from "@/lib/validations/listing-quick-price"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id: rawId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }
    const listingId = idParsed.data

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = listingQuickPriceBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await updateSellerListingQuickPrice(supabase, {
      listingId,
      sellerUserId: user.id,
      priceUsd: parsed.data.priceUsd,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: { priceUsd: result.priceUsd } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
