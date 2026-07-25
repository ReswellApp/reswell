import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingVisibilitySource } from "@/lib/listing-visibility-sources"

export type ListingVisibilityEventRow = {
  id: string
  listing_id: string
  hidden_from_site: boolean
  source: string
  actor_user_id: string | null
  note: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor: { display_name: string | null; email: string | null } | null
}

export type InsertListingVisibilityEventInput = {
  listingId: string
  hiddenFromSite: boolean
  source: ListingVisibilitySource
  actorUserId?: string | null
  note?: string | null
  metadata?: Record<string, unknown>
}

export async function insertListingVisibilityEvent(
  client: SupabaseClient,
  input: InsertListingVisibilityEventInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await client.from("listing_visibility_events").insert({
    listing_id: input.listingId,
    hidden_from_site: input.hiddenFromSite,
    source: input.source,
    actor_user_id: input.actorUserId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) {
    return { ok: false, message: error.message }
  }
  return { ok: true }
}

export async function insertListingVisibilityEvents(
  client: SupabaseClient,
  inputs: InsertListingVisibilityEventInput[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (inputs.length === 0) return { ok: true }

  const { error } = await client.from("listing_visibility_events").insert(
    inputs.map((input) => ({
      listing_id: input.listingId,
      hidden_from_site: input.hiddenFromSite,
      source: input.source,
      actor_user_id: input.actorUserId ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
    })),
  )

  if (error) {
    return { ok: false, message: error.message }
  }
  return { ok: true }
}

type RawVisibilityEvent = {
  id: string
  listing_id: string
  hidden_from_site: boolean
  source: string
  actor_user_id: string | null
  note: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function mapEvent(
  row: RawVisibilityEvent,
  actorById: Map<string, { display_name: string | null; email: string | null }>,
): ListingVisibilityEventRow {
  const actorId = row.actor_user_id
  return {
    id: row.id,
    listing_id: row.listing_id,
    hidden_from_site: row.hidden_from_site,
    source: row.source,
    actor_user_id: row.actor_user_id,
    note: row.note,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    actor: actorId ? (actorById.get(actorId) ?? null) : null,
  }
}

async function loadActors(
  client: SupabaseClient,
  actorIds: string[],
): Promise<Map<string, { display_name: string | null; email: string | null }>> {
  const unique = [...new Set(actorIds.filter(Boolean))]
  const map = new Map<string, { display_name: string | null; email: string | null }>()
  if (unique.length === 0) return map

  const { data, error } = await client
    .from("profiles")
    .select("id, display_name, email")
    .in("id", unique)

  if (error || !data) return map

  for (const row of data as {
    id: string
    display_name: string | null
    email: string | null
  }[]) {
    map.set(row.id, { display_name: row.display_name, email: row.email })
  }
  return map
}

/** Latest visibility event per listing (any direction). */
export async function fetchLatestVisibilityEventsForListings(
  client: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, ListingVisibilityEventRow>> {
  const result = new Map<string, ListingVisibilityEventRow>()
  const ids = [...new Set(listingIds.filter(Boolean))]
  if (ids.length === 0) return result

  const { data, error } = await client
    .from("listing_visibility_events")
    .select(
      "id, listing_id, hidden_from_site, source, actor_user_id, note, metadata, created_at",
    )
    .in("listing_id", ids)
    .order("created_at", { ascending: false })

  if (error || !data) return result

  const rows = data as RawVisibilityEvent[]
  const actorById = await loadActors(
    client,
    rows.map((r) => r.actor_user_id).filter((id): id is string => !!id),
  )

  for (const row of rows) {
    if (result.has(row.listing_id)) continue
    result.set(row.listing_id, mapEvent(row, actorById))
  }

  return result
}

/** Prefer the latest *hide* event; fall back to latest event of any kind. */
export async function fetchLatestHideEventsForListings(
  client: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, ListingVisibilityEventRow>> {
  const result = new Map<string, ListingVisibilityEventRow>()
  const ids = [...new Set(listingIds.filter(Boolean))]
  if (ids.length === 0) return result

  const { data, error } = await client
    .from("listing_visibility_events")
    .select(
      "id, listing_id, hidden_from_site, source, actor_user_id, note, metadata, created_at",
    )
    .in("listing_id", ids)
    .eq("hidden_from_site", true)
    .order("created_at", { ascending: false })

  if (error || !data) {
    return fetchLatestVisibilityEventsForListings(client, ids)
  }

  const rows = data as RawVisibilityEvent[]
  const actorById = await loadActors(
    client,
    rows.map((r) => r.actor_user_id).filter((id): id is string => !!id),
  )

  for (const row of rows) {
    if (result.has(row.listing_id)) continue
    result.set(row.listing_id, mapEvent(row, actorById))
  }

  const missing = ids.filter((id) => !result.has(id))
  if (missing.length > 0) {
    const fallback = await fetchLatestVisibilityEventsForListings(client, missing)
    for (const [id, event] of fallback) {
      result.set(id, event)
    }
  }

  return result
}

export async function fetchListingVisibilityHistory(
  client: SupabaseClient,
  listingId: string,
  limit = 50,
): Promise<{ rows: ListingVisibilityEventRow[]; error: string | null }> {
  const { data, error } = await client
    .from("listing_visibility_events")
    .select(
      "id, listing_id, hidden_from_site, source, actor_user_id, note, metadata, created_at",
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) {
    return { rows: [], error: error.message }
  }

  const rows = (data ?? []) as RawVisibilityEvent[]
  const actorById = await loadActors(
    client,
    rows.map((r) => r.actor_user_id).filter((id): id is string => !!id),
  )

  return {
    rows: rows.map((row) => mapEvent(row, actorById)),
    error: null,
  }
}
