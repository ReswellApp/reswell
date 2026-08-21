import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { createClient } from "@/lib/supabase/server"
import { createSellerInitiatedOffer } from "@/lib/services/createSellerInitiatedOffer"
import { listSellerOfferListings } from "@/lib/services/sellerOfferListings"
import { sellerInitiatedOfferBodySchema } from "@/lib/validations/seller-initiated-offer"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Sign in to send an offer." }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const idParsed = listingIdParamSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid listing id." }, { status: 400 })
  }

  const anchorOnly = request.nextUrl.searchParams.get("anchorOnly") === "1"
  const result = await listSellerOfferListings(supabase, user.id, idParsed.data, {
    anchorOnly,
  })
  if (!result.ok) {
    const failed = NextResponse.json({ error: result.error }, { status: result.status })
    failed.headers.set("Cache-Control", "private, no-store")
    return failed
  }

  const response = NextResponse.json({ data: { listings: result.listings } }, { status: 200 })
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to send an offer." }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const idParsed = listingIdParamSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid listing id." }, { status: 400 })
  }
  const listingId = idParsed.data

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = sellerInitiatedOfferBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await createSellerInitiatedOffer(supabase, user.id, listingId, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  revalidatePath("/dashboard/offers")

  return NextResponse.json(
    {
      data: {
        offerId: result.offerId,
        conversationId: result.conversationId,
      },
    },
    { status: 201 },
  )
}
