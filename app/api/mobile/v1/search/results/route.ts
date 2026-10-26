import { NextRequest, NextResponse } from "next/server"
import { mobileSearchQuerySchema } from "@reswell/api-contract"
import { searchMobileResultsService } from "@/lib/services/mobileSearch"

export const dynamic = "force-dynamic"

/** Full marketplace results. Same ranking as the website `/search` page. */
export async function GET(request: NextRequest) {
  try {
    const parsed = mobileSearchQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search query" }, { status: 400 })
    }

    const result = await searchMobileResultsService(parsed.data.q)
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
    console.error("[mobile-api] search results failed", {
      route: "/api/mobile/v1/search/results",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to search listings right now" }, { status: 500 })
  }
}
