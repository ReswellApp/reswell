import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { createClient } from "@/lib/supabase/server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import { setListingSearchTags } from "@/lib/services/listingSearchTags"
import { listingSearchTagsBodySchema } from "@/lib/validations/listing-search-tags"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { id: rawListingId } = await context.params
  const listingId = typeof rawListingId === "string" ? decodeURIComponent(rawListingId.trim()) : ""
  if (!listingId || !UUID_RE.test(listingId)) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = listingSearchTagsBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await setListingSearchTags({
    listingId,
    searchTags: parsed.data.search_tags,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  const supabaseForEs = await createClient()
  await syncListingToIndex(supabaseForEs, listingId)
  await revalidateAfterListingSiteModeration(gate.ctx.supabase, [listingId])

  return NextResponse.json({ success: true, data: { search_tags: result.searchTags } }, { status: 200 })
}
