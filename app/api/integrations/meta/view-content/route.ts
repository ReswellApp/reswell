import { NextRequest, NextResponse } from "next/server"

import { metaViewContentBodySchema } from "@/lib/validations/metaViewContent"
import { trackMetaViewContentServerEvent } from "@/lib/meta/track-view-content-server-event"
import { isMetaCapiEnabled } from "@/lib/meta/conversions-api"
import { createClient } from "@/lib/supabase/server"

/**
 * Mirrors the browser Meta Pixel `ViewContent` (product detail page) to the Conversions API,
 * sharing the same `event_id` so Meta deduplicates the browser/server pair. Anonymous viewers
 * are fine — the `_fbp`/`_fbc` cookies + IP/UA supply match signals.
 */
export async function POST(request: NextRequest) {
  if (!isMetaCapiEnabled()) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = metaViewContentBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Best-effort identity: logged-in viewers raise match quality via hashed email + external id.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    await trackMetaViewContentServerEvent({
      eventId: parsed.data.event_id,
      listingId: parsed.data.listing_id,
      listingSlug: parsed.data.listing_slug ?? null,
      listingSection: parsed.data.listing_section ?? null,
      value: parsed.data.value ?? null,
      currency: parsed.data.currency,
      eventSourceUrl: parsed.data.source_url ?? null,
      viewerUserId: user?.id ?? null,
      viewerEmail: user?.email ?? null,
    })
  } catch (e) {
    console.error("[meta] view-content:", e)
    return NextResponse.json({ error: "Failed to record view" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
