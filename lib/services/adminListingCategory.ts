import { createServiceRoleClient } from "@/lib/supabase/server"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { updateAdminListingSectionCategory } from "@/lib/db/listings"
import { boardTypeFromCategoryId } from "@/lib/utils/board-type-from-category-id"
import type { AdminListingSection } from "@/lib/validations/admin-listing-category"

export async function setAdminListingCategory(params: {
  listingId: string
  section: AdminListingSection
  categoryId: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select("id")
    .eq("id", params.listingId)
    .maybeSingle()

  if (listingErr) {
    return { ok: false, message: listingErr.message }
  }
  if (!listing) {
    return { ok: false, message: "Listing not found" }
  }

  if (params.section === "fins") {
    if (params.categoryId !== USED_FINS_CATEGORY_ID) {
      return { ok: false, message: "Fins listings must use the Fins category." }
    }
    const { data: finCategory, error: finCatErr } = await service
      .from("categories")
      .select("id")
      .eq("id", USED_FINS_CATEGORY_ID)
      .maybeSingle()
    if (finCatErr) {
      return { ok: false, message: finCatErr.message }
    }
    if (!finCategory) {
      return {
        ok: false,
        message: "Fins category is missing — apply the fins marketplace migration first.",
      }
    }
    return updateAdminListingSectionCategory(service, params.listingId, {
      section: "fins",
      category_id: USED_FINS_CATEGORY_ID,
      board_type: null,
    })
  }

  const { data: category, error: catErr } = await service
    .from("categories")
    .select("id, board")
    .eq("id", params.categoryId)
    .maybeSingle()

  if (catErr) {
    return { ok: false, message: catErr.message }
  }
  if (!category) {
    return { ok: false, message: "Category not found" }
  }

  const isBoardCategory = category.board === true
  if (params.section === "surfboards" && !isBoardCategory) {
    return {
      ok: false,
      message: "Pick a surfboard category for this listing (shop categories cannot be used).",
    }
  }
  if (params.section === "new" && isBoardCategory) {
    return {
      ok: false,
      message: "Pick a shop category for this listing (surfboard shapes cannot be used).",
    }
  }

  if (params.section === "surfboards") {
    return updateAdminListingSectionCategory(service, params.listingId, {
      section: "surfboards",
      category_id: params.categoryId,
      board_type: boardTypeFromCategoryId(params.categoryId),
    })
  }

  return updateAdminListingSectionCategory(service, params.listingId, {
    section: "new",
    category_id: params.categoryId,
    board_type: null,
  })
}
