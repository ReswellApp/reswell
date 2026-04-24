"use server"

import { z } from "zod"
import {
  displayMarketplaceSearchQueryForAnalytics,
  normalizeMarketplaceSearchQueryForAnalytics,
  recordBrandDirectorySearchAnalyticsEvent,
} from "@/lib/services/searchAnalytics"

const schema = z.object({
  queryRaw: z.string().max(500),
  resultCount: z.number().int().min(0).max(500),
  backend: z.enum(["elasticsearch", "supabase"]),
})

export async function recordBrandDirectorySearchAnalytics(
  raw: z.input<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid payload" }
  }
  await recordBrandDirectorySearchAnalyticsEvent({
    queryDisplay: displayMarketplaceSearchQueryForAnalytics(parsed.data.queryRaw),
    queryNormalized: normalizeMarketplaceSearchQueryForAnalytics(parsed.data.queryRaw),
    resultCount: parsed.data.resultCount,
    backend: parsed.data.backend,
  })
  return { ok: true }
}
