import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listListingBrandModelAutofills,
  type ListingBrandModelAutofillRow,
} from "@/lib/db/listingBrandModelBackfill"

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
