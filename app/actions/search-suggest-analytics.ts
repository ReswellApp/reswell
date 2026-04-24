"use server"

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

export async function recordSearchSuggestPick(
  raw: z.input<typeof payloadSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload" }
  }
  await recordSearchSuggestPickEvent(parsed.data)
  return { ok: true }
}
