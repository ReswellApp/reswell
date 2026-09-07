import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GiveawayEntry,
  GiveawayEntryStatus,
  GiveawayEventKind,
  GiveawayEventSurface,
  GiveawayPrizeBrandId,
} from "@/lib/types/giveaways"

type GiveawayEntryRow = {
  id: string
  user_id: string
  giveaway_slug: string
  preferred_brand: string | null
  status: string
  listing_id: string | null
  signed_up_from_cta: boolean
  cta_clicked_at: string | null
  brand_selected_at: string | null
  created_at: string
  qualified_at: string | null
}

function mapGiveawayEntry(row: GiveawayEntryRow): GiveawayEntry {
  return {
    id: row.id,
    userId: row.user_id,
    giveawaySlug: row.giveaway_slug,
    preferredBrand: (row.preferred_brand as GiveawayPrizeBrandId | null) ?? null,
    status: row.status as GiveawayEntryStatus,
    listingId: row.listing_id,
    signedUpFromCta: row.signed_up_from_cta === true,
    ctaClickedAt: row.cta_clicked_at,
    brandSelectedAt: row.brand_selected_at,
    createdAt: row.created_at,
    qualifiedAt: row.qualified_at,
  }
}

const ENTRY_COLUMNS =
  "id, user_id, giveaway_slug, preferred_brand, status, listing_id, signed_up_from_cta, cta_clicked_at, brand_selected_at, created_at, qualified_at"

export async function getGiveawayEntryForUser(
  supabase: SupabaseClient,
  userId: string,
  giveawaySlug: string,
): Promise<GiveawayEntry | null> {
  const { data, error } = await supabase
    .from("giveaway_entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", userId)
    .eq("giveaway_slug", giveawaySlug)
    .maybeSingle()

  if (error) {
    console.error("[giveawayEntries] load failed", error.message)
    return null
  }
  if (!data) return null
  return mapGiveawayEntry(data as GiveawayEntryRow)
}

export async function upsertGiveawayEntry(
  supabase: SupabaseClient,
  params: {
    userId: string
    giveawaySlug: string
    preferredBrand?: GiveawayPrizeBrandId | null
    status: GiveawayEntryStatus
    listingId?: string | null
    signedUpFromCta?: boolean
    ctaClickedAt?: string | null
    brandSelectedAt?: string | null
    qualifiedAt?: string | null
  },
): Promise<GiveawayEntry | null> {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    giveaway_slug: params.giveawaySlug,
    status: params.status,
    updated_at: now,
  }
  if (params.preferredBrand !== undefined) {
    payload.preferred_brand = params.preferredBrand
  }
  if (params.listingId) {
    payload.listing_id = params.listingId
  }
  if (params.signedUpFromCta === true) {
    payload.signed_up_from_cta = true
  }
  if (params.ctaClickedAt) {
    payload.cta_clicked_at = params.ctaClickedAt
  }
  if (params.brandSelectedAt) {
    payload.brand_selected_at = params.brandSelectedAt
  }
  if (params.qualifiedAt !== undefined) {
    payload.qualified_at = params.qualifiedAt
  }

  const { data, error } = await supabase
    .from("giveaway_entries")
    .upsert(payload, { onConflict: "user_id,giveaway_slug" })
    .select(ENTRY_COLUMNS)
    .single()

  if (error) {
    console.error("[giveawayEntries] upsert failed", error.message)
    return null
  }
  return mapGiveawayEntry(data as GiveawayEntryRow)
}

export async function updateGiveawayEntry(
  supabase: SupabaseClient,
  params: {
    userId: string
    giveawaySlug: string
    preferredBrand?: GiveawayPrizeBrandId | null
    status?: GiveawayEntryStatus
    listingId?: string | null
    signedUpFromCta?: boolean
    ctaClickedAt?: string | null
    brandSelectedAt?: string | null
    qualifiedAt?: string | null
  },
): Promise<GiveawayEntry | null> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (params.preferredBrand !== undefined) {
    patch.preferred_brand = params.preferredBrand
  }
  if (params.status !== undefined) {
    patch.status = params.status
  }
  if (params.listingId) {
    patch.listing_id = params.listingId
  }
  if (params.signedUpFromCta === true) {
    patch.signed_up_from_cta = true
  }
  if (params.ctaClickedAt) {
    patch.cta_clicked_at = params.ctaClickedAt
  }
  if (params.brandSelectedAt) {
    patch.brand_selected_at = params.brandSelectedAt
  }
  if (params.qualifiedAt !== undefined) {
    patch.qualified_at = params.qualifiedAt
  }

  const { data, error } = await supabase
    .from("giveaway_entries")
    .update(patch)
    .eq("user_id", params.userId)
    .eq("giveaway_slug", params.giveawaySlug)
    .select(ENTRY_COLUMNS)
    .maybeSingle()

  if (error) {
    console.error("[giveawayEntries] update failed", error.message)
    return null
  }
  if (!data) return null
  return mapGiveawayEntry(data as GiveawayEntryRow)
}

export async function findPublishedSurfboardId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .eq("user_id", userId)
    .eq("section", "surfboards")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[giveawayEntries] published surfboard lookup failed", error.message)
    return null
  }
  return typeof data?.id === "string" ? data.id : null
}

export async function insertGiveawayEvent(
  supabase: SupabaseClient,
  row: {
    giveawaySlug: string
    event: GiveawayEventKind
    surface: GiveawayEventSurface
    preferredBrand?: GiveawayPrizeBrandId | null
    userId?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from("giveaway_events").insert({
    giveaway_slug: row.giveawaySlug,
    event: row.event,
    surface: row.surface,
    preferred_brand: row.preferredBrand ?? null,
    user_id: row.userId ?? null,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export type GiveawayAdminEntryRow = GiveawayEntryRow & {
  profile: { display_name: string | null; email: string | null } | null
  listing: { id: string; title: string | null; slug: string | null; status: string } | null
}

export async function listGiveawayEntriesForAdmin(
  supabase: SupabaseClient,
  giveawaySlug: string,
): Promise<GiveawayAdminEntryRow[]> {
  const { data, error } = await supabase
    .from("giveaway_entries")
    .select(ENTRY_COLUMNS)
    .eq("giveaway_slug", giveawaySlug)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[giveawayEntries] admin list failed", error.message)
    return []
  }

  const rows = (data ?? []) as GiveawayEntryRow[]
  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const listingIds = [
    ...new Set(rows.map((row) => row.listing_id).filter((id): id is string => Boolean(id))),
  ]

  const [profilesRes, listingsRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, display_name, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; email: string | null }[] }),
    listingIds.length > 0
      ? supabase.from("listings").select("id, title, slug, status").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null; slug: string | null; status: string }[] }),
  ])

  const profiles = new Map(
    (profilesRes.data ?? []).map((profile) => [profile.id, profile]),
  )
  const listings = new Map(
    (listingsRes.data ?? []).map((listing) => [listing.id, listing]),
  )

  return rows.map((row) => ({
    ...row,
    profile: profiles.get(row.user_id) ?? null,
    listing: row.listing_id ? listings.get(row.listing_id) ?? null : null,
  }))
}

export async function countGiveawayEvents(
  supabase: SupabaseClient,
  params: {
    giveawaySlug: string
    event: GiveawayEventKind
    preferredBrand?: GiveawayPrizeBrandId
  },
): Promise<number> {
  let query = supabase
    .from("giveaway_events")
    .select("id", { count: "exact", head: true })
    .eq("giveaway_slug", params.giveawaySlug)
    .eq("event", params.event)

  if (params.preferredBrand) {
    query = query.eq("preferred_brand", params.preferredBrand)
  }

  const { count, error } = await query
  if (error) {
    console.error("[giveawayEntries] event count failed", error.message)
    return 0
  }
  return count ?? 0
}
