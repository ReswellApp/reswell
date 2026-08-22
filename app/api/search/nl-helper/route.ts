import { NextRequest, NextResponse } from "next/server"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { attachNlHelperSnapshotToEvent } from "@/lib/services/searchQuality"
import { runMarketplaceNlHelper } from "@/lib/services/marketplaceNlHelper"

export const maxDuration = 30

/**
 * Parallel NL search helper — Gemini via AI Gateway.
 * GET /api/search/nl-helper?q=...
 *
 * Called from the client after first paint so Enter stays on the fast rules/ES path.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const eventId = request.nextUrl.searchParams.get("eventId")?.trim() || null
  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "empty_query",
      appliedLabels: [],
      summary: "",
      refine: {},
    })
  }

  try {
    const supabase = createAnonSupabaseClient()
    const result = await runMarketplaceNlHelper(supabase, q)
    try {
      await attachNlHelperSnapshotToEvent({
        eventId,
        rawQuery: q,
        skipped: Boolean(result.skipped),
        reason: result.reason ?? null,
        summary: result.summary,
        appliedLabels: result.appliedLabels,
        refine: result.refine,
      })
    } catch (e) {
      console.error("[api/search/nl-helper] quality attach failed:", e)
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/search/nl-helper] failed:", msg)
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "error",
        appliedLabels: [],
        summary: "",
        refine: {},
      },
      { status: 200 },
    )
  }
}
