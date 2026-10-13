import { NextResponse } from "next/server"
import { getMobileSellTaxonomy } from "@/lib/services/mobileSellTaxonomy"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(
      { data: getMobileSellTaxonomy() },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" },
      },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sell/taxonomy", error, "Unable to load sell categories right now")
  }
}
