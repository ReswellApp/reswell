import { NextRequest, NextResponse } from "next/server"
import { mobileListingsQuerySchema } from "@reswell/api-contract"
import { listMobileListingsService } from "@/lib/services/mobileApi"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const parsed = mobileListingsQuerySchema.safeParse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      section: request.nextUrl.searchParams.get("section") ?? undefined,
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      board_type: request.nextUrl.searchParams.get("board_type") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid listings query" }, { status: 400 })
    }

    const result = await listMobileListingsService(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(
      { data: result.data },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
      },
    )
  } catch (error) {
    console.error("[mobile-api] listings failed", {
      route: "/api/mobile/v1/listings",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load listings right now" }, { status: 500 })
  }
}
