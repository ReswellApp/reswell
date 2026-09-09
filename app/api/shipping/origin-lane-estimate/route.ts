import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOriginLaneShippingEstimate } from "@/lib/services/originLaneShippingEstimate"
import { originLaneShippingEstimateSchema } from "@/lib/validations/origin-lane-shipping-estimate"

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

  const parsed = originLaneShippingEstimateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await getOriginLaneShippingEstimate(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json(
    {
      data: {
        originLabel: result.originLabel,
        inState: result.inState,
        crossCountry: result.crossCountry,
      },
    },
    { status: 200 },
  )
}
