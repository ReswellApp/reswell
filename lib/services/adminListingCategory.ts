import { createServiceRoleClient } from "@/lib/supabase/server"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { USED_WETSUITS_CATEGORY_ID } from "@/lib/wetsuit-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import { USED_SURFPACKS_CATEGORY_ID } from "@/lib/surfpack-listing-config"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { updateAdminListingSectionCategory } from "@/lib/db/listings"
import { boardTypeFromCategoryId } from "@/lib/utils/board-type-from-category-id"
import type { AdminListingSection } from "@/lib/validations/admin-listing-category"

/**
 * Peer accessory sections each map to one fixed category row (board_type null).
 * Changing a listing to one of these sections must use the section's category.
 */
const FIXED_CATEGORY_SECTIONS: Partial<Record<AdminListingSection, { categoryId: string; label: string }>> = {
  fins: { categoryId: USED_FINS_CATEGORY_ID, label: "Fins" },
  wetsuits: { categoryId: USED_WETSUITS_CATEGORY_ID, label: "Wetsuits" },
  boardbags: { categoryId: USED_BOARDBAGS_CATEGORY_ID, label: "Boardbags" },
  surfpacks: { categoryId: USED_SURFPACKS_CATEGORY_ID, label: "Surfpacks" },
  leashes: { categoryId: USED_LEASHES_CATEGORY_ID, label: "Leashes" },
  apparel: { categoryId: USED_APPAREL_CATEGORY_ID, label: "Apparel" },
  accessories: { categoryId: USED_ACCESSORIES_CATEGORY_ID, label: "Accessories" },
}

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

  const fixedCategory = FIXED_CATEGORY_SECTIONS[params.section]
  if (fixedCategory) {
    if (params.categoryId !== fixedCategory.categoryId) {
      return { ok: false, message: `${fixedCategory.label} listings must use the ${fixedCategory.label} category.` }
    }
    const { data: peerCategory, error: peerCatErr } = await service
      .from("categories")
      .select("id")
      .eq("id", fixedCategory.categoryId)
      .maybeSingle()
    if (peerCatErr) {
      return { ok: false, message: peerCatErr.message }
    }
    if (!peerCategory) {
      return {
        ok: false,
        message: `${fixedCategory.label} category is missing — apply the marketplace migration first.`,
      }
    }
    return updateAdminListingSectionCategory(service, params.listingId, {
      section: params.section,
      category_id: fixedCategory.categoryId,
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
