import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertListingVisibilityEvent,
  insertListingVisibilityEvents,
  type InsertListingVisibilityEventInput,
} from "@/lib/db/listingVisibilityEvents"
import type { ListingVisibilitySource } from "@/lib/listing-visibility-sources"

/** Best-effort audit write — never fails the primary visibility mutation. */
export async function recordListingVisibilityEvent(
  client: SupabaseClient,
  input: InsertListingVisibilityEventInput,
): Promise<void> {
  const result = await insertListingVisibilityEvent(client, input)
  if (!result.ok) {
    console.error("[listingVisibilityAudit] insert failed:", result.message, {
      listingId: input.listingId,
      source: input.source,
      hiddenFromSite: input.hiddenFromSite,
    })
  }
}

export async function recordListingVisibilityEvents(
  client: SupabaseClient,
  inputs: InsertListingVisibilityEventInput[],
): Promise<void> {
  if (inputs.length === 0) return
  const result = await insertListingVisibilityEvents(client, inputs)
  if (!result.ok) {
    console.error("[listingVisibilityAudit] bulk insert failed:", result.message, {
      count: inputs.length,
      sources: [...new Set(inputs.map((i) => i.source))],
    })
  }
}

export function visibilityEventInput(params: {
  listingId: string
  hiddenFromSite: boolean
  source: ListingVisibilitySource
  actorUserId?: string | null
  note?: string | null
  metadata?: Record<string, unknown>
}): InsertListingVisibilityEventInput {
  return {
    listingId: params.listingId,
    hiddenFromSite: params.hiddenFromSite,
    source: params.source,
    actorUserId: params.actorUserId,
    note: params.note,
    metadata: params.metadata,
  }
}
