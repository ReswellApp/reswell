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
    return NextResponse.json({ error: "Enter a model name." }, { status: 400 })
  }

  const { brandId, requestedModelName, notes } = parsed.data

  const { data: brandRow } = await supabase.from("brands").select("id").eq("id", brandId).maybeSingle()
  if (!brandRow) {
    return NextResponse.json({ error: "Brand not found." }, { status: 400 })
  }

  const notesTrimmed = notes?.trim() || null

  const result = await submitSellBrandModelRequestService(supabase, {
    userId: user.id,
    brandId,
    requestedModelName,
    notes: notesTrimmed,
  })

  if (!result.ok) {
    return NextResponse.json({ error: "Could not save your request. Try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
