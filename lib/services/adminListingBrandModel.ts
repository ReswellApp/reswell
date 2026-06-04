import {
  applyListingBrandModelAttach,
  clearListingBrandModelUnmatched,
  type ListingBrandModelPatch,
} from "@/lib/db/listingBrandModelBackfill"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { AdminListingBrandModelBody } from "@/lib/validations/admin-listing-brand-model"

export type SetAdminListingBrandModelResult =
  | {
      ok: true
      listingId: string
      brandId: string | null
      brandModelId: string | null
      brand: string | null
      model: string | null
      slug: string | null
    }
  | { ok: false; status: number; error: string }

/**
 * Links a surfboard listing to the directory brand and/or catalog model (service role).
 * Clears the unmatched worklist row when both links are present; re-syncs Elasticsearch.
 */
export async function setAdminListingBrandModel(
  listingId: string,
  body: AdminListingBrandModelBody,
): Promise<SetAdminListingBrandModelResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, status: 500, error: "Server misconfigured" }
  }

  const lid = listingId.trim()
  const brandModelId = body.brand_model_id?.trim() || null
  const brandIdInput = body.brand_id?.trim() || null

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select("id, section, status, slug, brand_id, brand_model_id")
    .eq("id", lid)
    .maybeSingle()

  if (listingErr) {
    return { ok: false, status: 500, error: listingErr.message }
  }
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found" }
  }
  if (listing.section !== "surfboards") {
    return { ok: false, status: 400, error: "Only surfboard listings support catalog brand/model links" }
  }

  const patch: ListingBrandModelPatch = {}

  if (brandModelId) {
    const { data: modelRow, error: modelErr } = await service
      .from("brand_models")
      .select("id, name, brand_id, brands:brand_id ( id, name )")
      .eq("id", brandModelId)
      .maybeSingle()

    if (modelErr) {
      return { ok: false, status: 500, error: modelErr.message }
    }
    if (!modelRow?.id || !modelRow.brand_id) {
      return { ok: false, status: 404, error: "Catalog model not found" }
    }

    const joined = modelRow.brands as { id: string; name: string } | { id: string; name: string }[] | null
    const brand = Array.isArray(joined) ? joined[0] : joined
    if (!brand?.name?.trim()) {
      return { ok: false, status: 404, error: "Catalog brand for model not found" }
    }

    if (brandIdInput && brandIdInput !== modelRow.brand_id) {
      return { ok: false, status: 400, error: "brand_model_id does not belong to brand_id" }
    }

    patch.brand_model_id = modelRow.id
    patch.model = modelRow.name.trim()
    patch.brand_id = modelRow.brand_id
    patch.brand = brand.name.trim()
  } else if (brandIdInput) {
    const { data: brandRow, error: brandErr } = await service
      .from("brands")
      .select("id, name")
      .eq("id", brandIdInput)
      .maybeSingle()

    if (brandErr) {
      return { ok: false, status: 500, error: brandErr.message }
    }
    if (!brandRow?.id || !brandRow.name?.trim()) {
      return { ok: false, status: 404, error: "Brand not found" }
    }

    patch.brand_id = brandRow.id
    patch.brand = brandRow.name.trim()

    if (listing.brand_model_id) {
      const { data: existingModel } = await service
        .from("brand_models")
        .select("brand_id")
        .eq("id", listing.brand_model_id)
        .maybeSingle()

      if (existingModel?.brand_id && existingModel.brand_id !== brandRow.id) {
        patch.brand_model_id = null
        patch.model = null
      }
    }
  }

  const result = await applyListingBrandModelAttach(service, lid, patch)
  if (!result.ok) {
    return { ok: false, status: 500, error: result.message }
  }

  const { data: updated } = await service
    .from("listings")
    .select("brand_id, brand_model_id, brand, model, slug")
    .eq("id", lid)
    .maybeSingle()

  const brandId = updated?.brand_id ?? patch.brand_id ?? null
  const resolvedBrandModelId = updated?.brand_model_id ?? patch.brand_model_id ?? null
  if (brandId && resolvedBrandModelId) {
    await clearListingBrandModelUnmatched(service, lid)
  }

  await syncListingToIndex(service, lid).catch((e) => {
    console.error("[admin listing brand-model] ES re-sync failed", {
      listingId: lid,
      error: e instanceof Error ? e.message : String(e),
    })
  })

  const slug =
    updated && typeof updated.slug === "string" ? updated.slug.trim() || null : null

  return {
    ok: true,
    listingId: lid,
    brandId,
    brandModelId: resolvedBrandModelId,
    brand: updated?.brand?.trim() || patch.brand || null,
    model: updated?.model?.trim() || patch.model || null,
    slug,
  }
}
