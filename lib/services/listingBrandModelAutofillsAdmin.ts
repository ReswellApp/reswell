import type { SupabaseClient } from "@supabase/supabase-js"
import {
  clearListingBrandIfMatches,
  clearListingModelIfMatches,
  deleteListingBrandModelAutofill,
  getListingBrandModelAutofillById,
  listListingBrandModelAutofills,
  listListingBrandModelUnmatched,
  type ListingBrandModelAutofillRow,
  type ListingBrandModelUnmatchedRow,
} from "@/lib/db/listingBrandModelBackfill"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"

/** Admin verification row: what the cron attached + the listing's current state. */
export type AdminListingBrandModelAutofill = {
  id: string
  createdAt: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listingStatus: string | null
  primaryImageUrl: string | null
  attachedBrand: boolean
  attachedModel: boolean
  /** Brand/model the cron attached (canonical catalog labels). */
  brandName: string | null
  modelName: string | null
  /** Brand/model currently on the listing (may differ if edited since). */
  currentBrand: string | null
  currentModel: string | null
  /** Whether the cron's link is still the one on the listing. */
  brandStillLinked: boolean
  modelStillLinked: boolean
  listingDeleted: boolean
}

export type AdminListingBrandModelAutofillsResult = {
  rows: AdminListingBrandModelAutofill[]
  summary: {
    total: number
    brandAttached: number
    modelAttached: number
    /** Auto-attached links that are no longer present on the listing (edited/cleared). */
    changedSince: number
  }
}

function pickPrimaryImageUrl(
  images: { url: string | null; is_primary: boolean | null }[],
): string | null {
  if (images.length === 0) return null
  const primary = images.find((img) => img.is_primary)
  return (primary ?? images[0])?.url ?? null
}

function toAdminRow(row: ListingBrandModelAutofillRow): AdminListingBrandModelAutofill {
  const listing = row.listing
  const brandStillLinked =
    row.attached_brand && !!row.brand_id && listing?.brand_id === row.brand_id
  const modelStillLinked =
    row.attached_model && !!row.brand_model_id && listing?.brand_model_id === row.brand_model_id

  return {
    id: row.id,
    createdAt: row.created_at,
    listingId: row.listing_id,
    listingTitle: (listing?.title ?? row.listing_title ?? "").trim() || "Untitled listing",
    listingSlug: listing?.slug ?? null,
    listingSection: listing?.section ?? "surfboards",
    listingStatus: listing?.status ?? null,
    primaryImageUrl: pickPrimaryImageUrl(listing?.listing_images ?? []),
    attachedBrand: row.attached_brand,
    attachedModel: row.attached_model,
    brandName: row.brand_name?.trim() || null,
    modelName: row.model_name?.trim() || null,
    currentBrand: listing?.brand?.trim() || null,
    currentModel: listing?.model?.trim() || null,
    brandStillLinked,
    modelStillLinked,
    listingDeleted: listing == null,
  }
}

/**
 * Auto-attached brand/model audit rows for the admin verification page, joined to
 * each listing's current state so admins can spot links that were later changed.
 */
export async function getListingBrandModelAutofillsForAdmin(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<AdminListingBrandModelAutofillsResult> {
  const rows = (await listListingBrandModelAutofills(supabase, options)).map(toAdminRow)

  let brandAttached = 0
  let modelAttached = 0
  let changedSince = 0
  for (const row of rows) {
    if (row.attachedBrand) brandAttached += 1
    if (row.attachedModel) modelAttached += 1
    const brandDrifted = row.attachedBrand && !row.brandStillLinked
    const modelDrifted = row.attachedModel && !row.modelStillLinked
    if (row.listingDeleted || brandDrifted || modelDrifted) changedSince += 1
  }

  return {
    rows,
    summary: { total: rows.length, brandAttached, modelAttached, changedSince },
  }
}

export type UndoListingBrandModelAutofillResult =
  | { ok: true; clearedBrand: boolean; clearedModel: boolean }
  | { ok: false; status: number; error: string }

/**
 * Undo a cron-attached brand/model: clears the link from the listing (only when it
 * still matches what the cron set, so manual edits are preserved), removes the audit
 * row, and re-syncs the listing to Elasticsearch.
 */
export async function undoListingBrandModelAutofill(
  supabase: SupabaseClient,
  autofillId: string,
): Promise<UndoListingBrandModelAutofillResult> {
  const audit = await getListingBrandModelAutofillById(supabase, autofillId)
  if (!audit) {
    return { ok: false, status: 404, error: "Autofill not found" }
  }

  let clearedBrand = false
  let clearedModel = false

  if (audit.attached_brand && audit.brand_id) {
    clearedBrand = await clearListingBrandIfMatches(supabase, audit.listing_id, audit.brand_id)
  }
  if (audit.attached_model && audit.brand_model_id) {
    clearedModel = await clearListingModelIfMatches(
      supabase,
      audit.listing_id,
      audit.brand_model_id,
    )
  }

  await deleteListingBrandModelAutofill(supabase, autofillId)

  // The listing is now missing a brand/model again — keep ES + the worklist in step.
  await syncListingToIndex(supabase, audit.listing_id).catch((e) => {
    console.error("[brand-model-autofill undo] ES re-sync failed", {
      listingId: audit.listing_id,
      error: e instanceof Error ? e.message : String(e),
    })
  })

  return { ok: true, clearedBrand, clearedModel }
}

export type AdminListingBrandModelUnmatched = {
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listingStatus: string | null
  primaryImageUrl: string | null
  needsBrand: boolean
  needsModel: boolean
  /** Brand to add the missing model under (when only the model is unresolved). */
  matchedBrandName: string | null
  firstSeenAt: string
  lastSeenAt: string
}

export type AdminListingBrandModelUnmatchedResult = {
  rows: AdminListingBrandModelUnmatched[]
  summary: { total: number; needsBrand: number; needsModel: number }
}

/** True when the listing still actually has the gap recorded (not already resolved/gone). */
function unmatchedRowStillRelevant(row: ListingBrandModelUnmatchedRow): boolean {
  const listing = row.listing
  if (!listing) return false
  if (listing.status !== "active") return false
  const brandGap = row.needs_brand && !listing.brand_id
  const modelGap = row.needs_model && !listing.brand_model_id
  return brandGap || modelGap
}

function toUnmatchedAdminRow(
  row: ListingBrandModelUnmatchedRow,
): AdminListingBrandModelUnmatched {
  const listing = row.listing
  return {
    listingId: row.listing_id,
    listingTitle: (listing?.title ?? row.listing_title ?? "").trim() || "Untitled listing",
    listingSlug: listing?.slug ?? null,
    listingSection: listing?.section ?? "surfboards",
    listingStatus: listing?.status ?? null,
    primaryImageUrl: pickPrimaryImageUrl(listing?.listing_images ?? []),
    // Reflect the listing's live state so a partially-resolved gap shows correctly.
    needsBrand: row.needs_brand && !listing?.brand_id,
    needsModel: row.needs_model && !listing?.brand_model_id,
    matchedBrandName: row.matched_brand_name?.trim() || null,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }
}

/**
 * Listings whose title the cron could not match to a catalog brand/model — a worklist
 * for adding missing entries. Rows already resolved (or whose listing is gone/inactive)
 * are filtered out so the list stays actionable.
 */
export async function getListingBrandModelUnmatchedForAdmin(
  supabase: SupabaseClient,
  options?: { limit?: number },
): Promise<AdminListingBrandModelUnmatchedResult> {
  const raw = await listListingBrandModelUnmatched(supabase, options)
  const rows = raw.filter(unmatchedRowStillRelevant).map(toUnmatchedAdminRow)

  let needsBrand = 0
  let needsModel = 0
  for (const row of rows) {
    if (row.needsBrand) needsBrand += 1
    if (row.needsModel) needsModel += 1
  }

  return { rows, summary: { total: rows.length, needsBrand, needsModel } }
}
