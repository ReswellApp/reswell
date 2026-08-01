import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { reindexElasticsearchFromSupabase } from "@/lib/services/elasticsearchReindex"

/**
 * Full reindex of searchable Elasticsearch surfaces from Supabase.
 * POST /api/search/reindex
 *
 * Auth: either
 * - Authorization: Bearer <SEARCH_REINDEX_SECRET> (for CI/scripts)
 * - Valid admin session (cookie) — no secret needed; use admin UI
 *
 * Hourly catch-up: `GET /api/cron/elasticsearch-reindex` (CRON_SECRET).
 */
export async function POST(request: NextRequest) {
  let authorized = false

  const secret = process.env.SEARCH_REINDEX_SECRET
  const auth = request.headers.get("authorization") || ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (secret && token === secret) {
    authorized = true
  }

  if (!authorized) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single()
      if (profile?.is_admin) authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel (Production) or .env.local (local). Get it from Supabase → Settings → API.",
      },
      { status: 503 },
    )
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return NextResponse.json({ error: "Server config: missing service role" }, { status: 503 })
  }

  const result = await reindexElasticsearchFromSupabase(supabase)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    ...result.summary,
  })
}
