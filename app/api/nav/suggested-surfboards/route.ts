import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getNavSuggestedSurfboardPoolCached,
  NAV_SUGGESTED_SURFBOARDS_REVALIDATE_SECONDS,
} from "@/lib/cache/nav-suggested-surfboards"

const modeSchema = z.enum(["popular", "newest"])

/**
 * GET `/api/nav/suggested-surfboards?mode=popular|newest`
 * Cached surfboard pool for the header nav idle search dropdown.
 */
export async function GET(req: NextRequest) {
  try {
    const parsed = modeSchema.safeParse(
      new URL(req.url).searchParams.get("mode") ?? "popular",
    )
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const rows = await getNavSuggestedSurfboardPoolCached(parsed.data)

    return NextResponse.json(
      { data: { rows } },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${NAV_SUGGESTED_SURFBOARDS_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
        },
      },
    )
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
