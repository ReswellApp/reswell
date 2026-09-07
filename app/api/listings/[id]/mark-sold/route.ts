import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { markSellerListingSoldOffPlatform } from "@/lib/services/listingMarkSold"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { markListingSoldBodySchema } from "@/lib/validations/mark-listing-sold"

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
    const listingId = idParsed.data

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = markListingSoldBodySchema.safeParse(body)
    if (!parsed.success) {
      const detailIssue = parsed.error.flatten().fieldErrors.detail?.[0]
      return NextResponse.json(
        { error: detailIssue ?? "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await markSellerListingSoldOffPlatform(supabase, {
      listingId,
      sellerUserId: user.id,
      sellerEmail: user.email,
      channel: parsed.data.channel,
      detail: parsed.data.detail,
      reswellHelpedFindBuyer: parsed.data.reswellHelpedFindBuyer,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { data: { ok: true, priceUsd: result.priceUsd } },
      { status: 200 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
