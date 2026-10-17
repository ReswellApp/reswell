import { NextRequest, NextResponse } from "next/server"
import { mobileSellersQuerySchema } from "@reswell/api-contract"
import { getMobileSellersPageService } from "@/lib/services/mobileSellers"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const parsed = mobileSellersQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sellers query" }, { status: 400 })
    }
    const result = await getMobileSellersPageService(parsed.data.q)
    return mobileDataResponse(result, "public, s-maxage=60, stale-while-revalidate=300")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/sellers", error, "Unable to load sellers right now")
  }
}
