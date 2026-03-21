import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteListingDocument,
  syncListingToIndex,
} from "@/lib/elasticsearch/listings-index"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"

type WebhookBody = {
  type?: string
  table?: string
  record?: { id?: string }
  old_record?: { id?: string }
}

/**
 * Supabase Database Webhook (or similar) to keep Elasticsearch in sync.
 * POST /api/search/es-webhook
 *
 * Set header: Authorization: Bearer <SUPABASE_ES_WEBHOOK_SECRET>
 * (or X-ES-Webhook-Secret: same value)
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_ES_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "SUPABASE_ES_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    )
  }

  const authOk =
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-es-webhook-secret") === secret

  if (!authOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isElasticsearchConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "es_not_configured" })
  }

  let body: WebhookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body.table !== "listings") {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const supabase = createServiceRoleClient()

  try {
    if (body.type === "DELETE") {
      const id = body.old_record?.id
      if (id) await deleteListingDocument(id)
      return NextResponse.json({ ok: true, action: "deleted" })
    }

    if (body.type === "INSERT" || body.type === "UPDATE") {
      const id = body.record?.id
      if (!id) {
        return NextResponse.json({ ok: true, ignored: true })
      }
      await syncListingToIndex(supabase, id)
      return NextResponse.json({ ok: true, action: "synced" })
    }

    return NextResponse.json({ ok: true, ignored: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
