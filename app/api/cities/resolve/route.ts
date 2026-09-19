import { NextRequest, NextResponse } from "next/server"
import { resolveCityLandingFromLocation } from "@/lib/services/resolveCityLanding"
import { cityLandingResolveQuerySchema } from "@/lib/validations/cityLandingResolve"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const parsed = cityLandingResolveQuerySchema.safeParse({
      label: searchParams.get("label") ?? "",
      city: searchParams.get("city") || undefined,
      state: searchParams.get("state") || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 })
    }

    const match = await resolveCityLandingFromLocation(parsed.data)
    return NextResponse.json(
      { data: match },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    )
  } catch (error) {
    console.error("[cities/resolve] failed", {
      route: "/api/cities/resolve",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
