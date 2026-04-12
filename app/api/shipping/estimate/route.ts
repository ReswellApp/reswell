import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTopSurfboardShippingRates } from "@/lib/services/surfboardShippingEstimate"
import { surfboardShippingEstimateSchema } from "@/lib/validations/surfboard-shipping-estimate"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in to get shipping estimates." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = surfboardShippingEstimateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await getTopSurfboardShippingRates(parsed.data, { topN: 3 })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({ data: { rates: result.rates } }, { status: 200 })
}
