import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { submitSellBrandModelRequestService } from "@/lib/services/brandModelRequestsSell"
import { brandModelRequestSellPostBodySchema } from "@/lib/validations/brand-model-requests-sell"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Sign in to submit a model request." }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const parsed = brandModelRequestSellPostBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Provide a model name and either a matched directory brand or the brand text from your listing."
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const brandIdTrim = parsed.data.brandId?.trim() ?? ""
  const sellerFreeTrim = parsed.data.sellerBrandName?.trim() ?? ""
  const requestedModelName = parsed.data.requestedModelName.trim()
  const notesTrimmed = parsed.data.notes?.trim() || null

  if (brandIdTrim) {
    const { data: brandRow } = await supabase.from("brands").select("id").eq("id", brandIdTrim).maybeSingle()
    if (!brandRow) {
      return NextResponse.json({ error: "Brand not found." }, { status: 400 })
    }

    const result = await submitSellBrandModelRequestService(supabase, {
      userId: user.id,
      brandId: brandIdTrim,
      requestedModelName,
      notes: notesTrimmed,
    })
    if (!result.ok) {
      return NextResponse.json({ error: "Could not save your request. Try again." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (!sellerFreeTrim) {
    return NextResponse.json(
      { error: "Include the brand above (as you typed it) so we know which maker this model belongs to." },
      { status: 400 },
    )
  }

  const result = await submitSellBrandModelRequestService(supabase, {
    userId: user.id,
    sellerBrandName: sellerFreeTrim,
    requestedModelName,
    notes: notesTrimmed,
  })

  if (!result.ok) {
    return NextResponse.json({ error: "Could not save your request. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
