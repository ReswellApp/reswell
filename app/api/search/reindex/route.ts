import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  ensureListingsIndex,
  indexListingDocument,
  listingRowToSearchDocFromRow,
} from "@/lib/elasticsearch/listings-index"
import { getElasticsearchClient } from "@/lib/elasticsearch/client"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"

/**
 * Full reindex of active surfboard (peer) listings into Elasticsearch.
 * POST /api/search/reindex
 *
 * Auth: either
 * - Authorization: Bearer <SEARCH_REINDEX_SECRET> (for CI/scripts)
 * - Valid admin session (cookie) — no secret needed; use admin UI
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
    const { data: { user } } = await supabase.auth.getUser()
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

  if (!isElasticsearchConfigured()) {
    return NextResponse.json(
      {
        error:
          "Elasticsearch is not configured. Set ELASTICSEARCH_URL plus ELASTICSEARCH_API_KEY (or username/password), or ELASTICSEARCH_ALLOW_ANONYMOUS=true for a local unsecured cluster.",
      },
      { status: 503 },
    )
  }

  const es = getElasticsearchClient()
  if (!es) {
    return NextResponse.json({ error: "Elasticsearch client unavailable" }, { status: 503 })
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

  try {
    await ensureListingsIndex()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Elasticsearch index setup failed: ${msg}` },
      { status: 503 },
    )
  }

  const supabase = createServiceRoleClient()
  const pageSize = 200
  let from = 0
  let indexed = 0
  let errors = 0

  for (;;) {
    const { data: rows, error } = await supabase
      .from("listings")
      .select(
        `
        id,
        title,
        description,
        section,
        status,
        board_type,
        brand,
        city,
        state,
        created_at,
        categories (name)
      `,
      )
      .eq("status", "active")
      .eq("section", "surfboards")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rows?.length) break

    for (const row of rows as any[]) {
      try {
        const doc = listingRowToSearchDocFromRow(row)
        await indexListingDocument(doc)
        indexed++
      } catch {
        errors++
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return NextResponse.json({ ok: true, indexed, errors })
}
