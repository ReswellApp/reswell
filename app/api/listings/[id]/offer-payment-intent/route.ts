import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createOfferAuthorizationPaymentIntent } from "@/lib/services/listingOfferAuthorization"
import { createListingOfferPaymentIntentBodySchema } from "@/lib/validations/listing-offer-authorization"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

const JSON_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to make an offer." }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const idParsed = listingIdParamSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid listing id." }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createListingOfferPaymentIntentBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await createOfferAuthorizationPaymentIntent(
    supabase,
    user,
    idParsed.data,
    parsed.data,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: JSON_NO_STORE_HEADERS })
  }

  return NextResponse.json(
    {
      data: {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        itemUsd: result.itemUsd,
        shippingUsd: result.shippingUsd,
        totalUsd: result.totalUsd,
      },
    },
    { status: 201, headers: JSON_NO_STORE_HEADERS },
  )
}
