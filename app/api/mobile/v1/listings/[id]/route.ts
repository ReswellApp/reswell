import { NextRequest, NextResponse } from "next/server"
import { mobileListingParamSchema } from "@reswell/api-contract"
import { getMobileListingService } from "@/lib/services/mobileApi"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const parsed = mobileListingParamSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    const result = await getMobileListingService(parsed.data.id)
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
    console.error("[mobile-api] listing failed", {
      route: "/api/mobile/v1/listings/[id]",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Unable to load listing right now" }, { status: 500 })
  }
}
