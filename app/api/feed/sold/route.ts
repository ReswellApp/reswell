import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { loadMarketplaceSoldFeedPage } from "@/lib/services/marketplaceSoldFeed"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

const soldFeedPageQuerySchema = z
  .object({
    soldAt: z.string().datetime({ offset: true }).optional(),
    listingId: z.string().uuid().optional(),
    brandSlug: z.string().trim().min(1).max(120).optional(),
  })
  .refine((value) => Boolean(value.soldAt) === Boolean(value.listingId), {
    message: "A complete cursor is required",
  })

export async function GET(request: NextRequest) {
  const parsed = soldFeedPageQuerySchema.safeParse({
    soldAt: request.nextUrl.searchParams.get("soldAt") ?? undefined,
    listingId: request.nextUrl.searchParams.get("listingId") ?? undefined,
    brandSlug: request.nextUrl.searchParams.get("brandSlug") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sold feed cursor" }, { status: 400 })
  }

  try {
    const supabase = createAnonSupabaseClient()
    const data = await loadMarketplaceSoldFeedPage(
      supabase,
      parsed.data.brandSlug ?? null,
      parsed.data.soldAt && parsed.data.listingId
        ? {
            soldAt: parsed.data.soldAt,
            listingId: parsed.data.listingId,
          }
        : null,
    )

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    )
  } catch (error) {
    console.error("[api/feed/sold]", error)
    return NextResponse.json({ error: "Unable to load sold listings" }, { status: 500 })
  }
}
