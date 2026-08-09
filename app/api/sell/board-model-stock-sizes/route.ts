import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getBoardModelStockSizesCached } from "@/lib/cache/board-model-stock-sizes"

const querySchema = z.object({
  brand_model_id: z.string().trim().uuid(),
})

/** Public: a catalog model's surfboard stock sizes for the /sell dimensions picker. */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({
    brand_model_id: req.nextUrl.searchParams.get("brand_model_id") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brand_model_id" }, { status: 400 })
  }

  try {
    const sizes = await getBoardModelStockSizesCached(parsed.data.brand_model_id)
    return NextResponse.json({ data: { sizes } }, { status: 200 })
  } catch (error) {
    console.error("GET /api/sell/board-model-stock-sizes:", error)
    return NextResponse.json({ error: "Could not load stock sizes" }, { status: 500 })
  }
}
