import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { createSellerSaleTipPaymentIntent } from "@/lib/services/sellerSaleTip"
import { saleTipBodySchema } from "@/lib/validations/mark-listing-sold"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function POST(
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = saleTipBodySchema.safeParse(body)
    if (!parsed.success) {
      const amountIssue = parsed.error.flatten().fieldErrors.amountCents?.[0]
      return NextResponse.json(
        { error: amountIssue ?? "Invalid tip amount" },
        { status: 400 },
      )
    }

    const result = await createSellerSaleTipPaymentIntent(supabase, {
      listingId: idParsed.data,
      sellerUserId: user.id,
      sellerEmail: user.email,
      amountCents: parsed.data.amountCents,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { data: { clientSecret: result.clientSecret, amountCents: result.amountCents } },
      { status: 200 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
