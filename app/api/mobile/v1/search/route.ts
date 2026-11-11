import { NextRequest, NextResponse } from "next/server"
import { mobileSearchQuerySchema } from "@reswell/api-contract"
import { consumeMobileSearchRateLimit } from "@/lib/redis/rate-limit"
import { searchMobileListingsService } from "@/lib/services/mobileSearch"
import { mobileTooManyRequests } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const limited = await consumeMobileSearchRateLimit(request)
    if (!limited.ok) {
      return mobileTooManyRequests(limited.retryAfterSec, "Too many searches. Try again in a moment.")
    }

    const parsed = mobileSearchQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search query" }, { status: 400 })
    }

    const result = await searchMobileListingsService(parsed.data.q)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { data: result.data },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      },
    )
  } catch (error) {
    console.error("[mobile-api] search failed", {
      route: "/api/mobile/v1/search",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to search listings right now" }, { status: 500 })
  }
}
