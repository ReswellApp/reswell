import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { recordSearchSuggestPickEvent } from "@/lib/services/searchAnalytics"

const pickKindSchema = z.enum([
  "top_listing",
  "brand_strip",
  "brand_row",
  "category_chip",
  "suggestion_title",
  "suggestion_brand",
  "suggestion_category",
  "view_all_results",
  "brand_catalog",
])

const surfaceSchema = z.enum(["header_nav", "sell_brand_title", "other"])

const traceSchema = z.enum([
  "marketplace_elasticsearch",
  "marketplace_supabase",
  "brand_catalog_elasticsearch",
  "brand_catalog_supabase",
])

const payloadSchema = z.object({
  surface: surfaceSchema,
  pickKind: pickKindSchema,
  suggestTrace: traceSchema,
  queryPrefix: z.string().max(500),
  selectionLabel: z.string().max(500),
  listingId: z.string().uuid().nullable(),
  interaction: z.enum(["pick", "hover"]).optional().default("pick"),
})

/**
 * POST `/api/search/suggest-pick`
 * Fire-and-forget typeahead pick analytics. Route handler (not a Server Action)
 * so recording a pick cannot queue behind / block header search navigation.
 */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  try {
    await recordSearchSuggestPickEvent(parsed.data)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
