import { NextRequest, NextResponse } from "next/server"
import { suggestGeocodePlaces } from "@/lib/services/geocodeSuggestions"

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim()
  /** Street-level + full labels (shipping admin). Default: city/ZIP oriented (boards search). */
  const detailFull =
    request.nextUrl.searchParams.get("detail") === "full" ||
    request.nextUrl.searchParams.get("address") === "1"

  try {
    const suggestions = await suggestGeocodePlaces(q, detailFull)
    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
        },
      },
    )
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
