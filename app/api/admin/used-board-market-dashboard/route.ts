import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getUsedBoardMarketDashboardService } from "@/lib/services/usedBoardMarketDashboard"
import type { DashboardRangeKey } from "@/lib/services/usedBoardMarketDashboard.shared"

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined))

const querySchema = z.object({
  range: z
    .enum(["30d", "90d", "180d", "365d", "all"])
    .optional()
    .default("90d"),
  brandId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  modelSlug: optionalString(120),
  variantId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  boardType: optionalString(64),
  condition: z
    .enum(["brand_new", "excellent", "very_good", "good", "fair", "poor"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  state: z
    .string()
    .min(2)
    .max(8)
    .optional()
    .or(z.literal("").transform(() => undefined)),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_employee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 })
  }

  // Cascading sanitization: clear dependent filters when their parent is missing.
  const brandId = parsed.data.brandId ?? null
  const modelSlug = brandId ? parsed.data.modelSlug ?? null : null
  const variantId = brandId && modelSlug ? parsed.data.variantId ?? null : null

  try {
    const data = await getUsedBoardMarketDashboardService({
      range: parsed.data.range as DashboardRangeKey,
      brandId,
      modelSlug,
      variantId,
      boardType: parsed.data.boardType ?? null,
      condition: parsed.data.condition ?? null,
      state: parsed.data.state ?? null,
    })
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("getUsedBoardMarketDashboardService failed:", message)
    return NextResponse.json(
      { error: "Could not load used board market dashboard" },
      { status: 500 },
    )
  }
}
