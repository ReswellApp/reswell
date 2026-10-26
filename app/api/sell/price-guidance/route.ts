import { NextRequest, NextResponse } from "next/server"
import { getCachedSellPriceGuidance } from "@/lib/cache/sell-price-guidance"
import { sellPriceGuidanceQuerySchema } from "@/lib/validations/sell-price-guidance"

/**
 * Public sell-flow pricing suggestion for a catalog brand + model (+ optional condition).
 * Backed by `price_guide_entries` editorial overlay + marketplace sold/ask stats.
 */
export async function GET(req: NextRequest) {
  const parsed = sellPriceGuidanceQuerySchema.safeParse({
    category_slug: req.nextUrl.searchParams.get("category_slug") ?? "",
    brand_id: req.nextUrl.searchParams.get("brand_id") ?? "",
    brand_model_id: req.nextUrl.searchParams.get("brand_model_id") ?? "",
    condition: req.nextUrl.searchParams.get("condition") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid price guidance query" }, { status: 400 })
  }

  try {
    const guidance = await getCachedSellPriceGuidance(parsed.data)
    return NextResponse.json({ data: { guidance } }, { status: 200 })
  } catch (error) {
    console.error("GET /api/sell/price-guidance:", error)
    return NextResponse.json({ error: "Could not load price guidance" }, { status: 500 })
  }
}
