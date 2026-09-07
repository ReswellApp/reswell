import type { SupabaseClient } from "@supabase/supabase-js"

import type { KlaviyoListingImage } from "@/lib/klaviyo/catalog-product"

export const UNFINISHED_LISTING_STALE_HOURS = 2 as const
export const UNFINISHED_LISTING_MAX_AGE_DAYS = 45 as const
export const UNFINISHED_LISTING_CRON_BATCH = 40 as const

export type UnfinishedListingDraftRow = {
  id: string
  user_id: string
  title: string | null
  description: string | null
  price: number | null
  section: string | null
  condition: string | null
  brand: string | null
  model: string | null
  board_type: string | null
  length_feet: number | null
  length_inches: number | null
  width: number | null
  thickness: number | null
  volume: number | null
  city: string | null
  state: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  created_at: string
  updated_at: string
  listing_images: KlaviyoListingImage[] | null
}

const ELIGIBLE_SELECT = [
  "id",
  "user_id",
  "title",
  "description",
  "price",
  "section",
  "condition",
  "brand",
  "model",
  "board_type",
  "length_feet",
  "length_inches",
  "width",
  "thickness",
  "volume",
  "city",
  "state",
  "local_pickup",
  "shipping_available",
  "created_at",
  "updated_at",
  "listing_images(url, thumbnail_url, is_primary, sort_order)",
].join(", ")

function asImageArray(value: unknown): KlaviyoListingImage[] | null {
  if (!Array.isArray(value)) return null
  return value as KlaviyoListingImage[]
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapEligibleRow(row: Record<string, unknown>): UnfinishedListingDraftRow | null {
  const id = typeof row.id === "string" ? row.id : ""
  const userId = typeof row.user_id === "string" ? row.user_id : ""
  const createdAt = typeof row.created_at === "string" ? row.created_at : ""
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : ""
  if (!id || !userId || !createdAt || !updatedAt) return null

  return {
    id,
    user_id: userId,
    title: asOptionalString(row.title),
    description: asOptionalString(row.description),
    price: asOptionalNumber(row.price),
    section: asOptionalString(row.section),
    condition: asOptionalString(row.condition),
    brand: asOptionalString(row.brand),
    model: asOptionalString(row.model),
    board_type: asOptionalString(row.board_type),
    length_feet: asOptionalNumber(row.length_feet),
    length_inches: asOptionalNumber(row.length_inches),
    width: asOptionalNumber(row.width),
    thickness: asOptionalNumber(row.thickness),
    volume: asOptionalNumber(row.volume),
    city: asOptionalString(row.city),
    state: asOptionalString(row.state),
    local_pickup: typeof row.local_pickup === "boolean" ? row.local_pickup : null,
    shipping_available: typeof row.shipping_available === "boolean" ? row.shipping_available : null,
    created_at: createdAt,
    updated_at: updatedAt,
    listing_images: asImageArray(row.listing_images),
  }
}

export function unfinishedListingCutoffs(referenceTime: Date): {
  staleBefore: Date
  newerThan: Date
} {
  const staleBefore = new Date(
    referenceTime.getTime() - UNFINISHED_LISTING_STALE_HOURS * 60 * 60 * 1000,
  )
  const newerThan = new Date(
    referenceTime.getTime() - UNFINISHED_LISTING_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  )
  return { staleBefore, newerThan }
}

/**
 * Signed-in drafts that have not been edited recently and have not been nudged.
 */
export async function fetchEligibleUnfinishedListingDrafts(
  supabase: SupabaseClient,
  referenceTime: Date,
  limit = UNFINISHED_LISTING_CRON_BATCH,
): Promise<{ data: UnfinishedListingDraftRow[]; error: string | null }> {
  const { staleBefore, newerThan } = unfinishedListingCutoffs(referenceTime)
  const fetchLimit = Math.min(Math.max(limit * 3, limit), 120)

  const runQuery = (includeArchivedFilter: boolean) => {
    let query = supabase
      .from("listings")
      .select(ELIGIBLE_SELECT)
      .eq("status", "draft")
      .not("user_id", "is", null)
      .lte("updated_at", staleBefore.toISOString())
      .gte("updated_at", newerThan.toISOString())
      .order("updated_at", { ascending: true })
      .limit(fetchLimit)
    if (includeArchivedFilter) {
      query = query.is("archived_at", null)
    }
    return query
  }

  let { data, error } = await runQuery(true)
  if (
    error &&
    (error.code === "42703" ||
      (typeof error.message === "string" && error.message.includes("archived_at")))
  ) {
    const retry = await runQuery(false)
    data = retry.data
    error = retry.error
  }
  if (error) {
    return { data: [], error: error.message }
  }

  const mapped = (data ?? [])
    .map((row) => mapEligibleRow(row as Record<string, unknown>))
    .filter((row): row is UnfinishedListingDraftRow => row != null)

  const candidateIds = mapped.map((row) => row.id)
  if (candidateIds.length === 0) {
    return { data: [], error: null }
  }

  const { data: nudged, error: nudgedError } = await supabase
    .from("unfinished_listing_klaviyo_nudges")
    .select("listing_id")
    .in("listing_id", candidateIds)

  if (nudgedError) {
    return { data: [], error: nudgedError.message }
  }

  const nudgedIds = new Set(
    (nudged ?? [])
      .map((row) => (typeof row.listing_id === "string" ? row.listing_id : ""))
      .filter(Boolean),
  )

  return {
    data: mapped.filter((row) => !nudgedIds.has(row.id)).slice(0, limit),
    error: null,
  }
}

export async function recordUnfinishedListingNudgeSent(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("unfinished_listing_klaviyo_nudges").upsert(
    {
      listing_id: listingId,
      user_id: userId,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" },
  )
  if (error) return { error: error.message }
  return { error: null }
}
