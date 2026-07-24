import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBuyerZoneShippingEstimate } from "@/lib/services/buyerZoneShippingEstimate"
import { buyerZoneShippingEstimateSchema } from "@/lib/validations/buyer-zone-shipping-estimate"
import type { ReswellBuyerEstimateZone } from "@/lib/surfboard-shipping-tiers"

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

  const parsed = buyerZoneShippingEstimateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await getBuyerZoneShippingEstimate({
    originZip: parsed.data.originZip,
    tierId: parsed.data.tierId,
    packBandId: parsed.data.packBandId,
    zone: parsed.data.zone as ReswellBuyerEstimateZone,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json(
    {
      data: {
        totalAmount: result.totalAmount,
        currency: result.currency,
        carrierName: result.carrierName,
        serviceName: result.serviceName,
        sampleCityLabel: result.sampleCityLabel,
        tierId: result.tierId,
        packBandId: result.packBandId,
        zone: result.zone,
      },
    },
    { status: 200 },
  )
}
