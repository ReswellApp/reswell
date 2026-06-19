import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { getConsignmentStoreById, getStoreStaffRole } from "@/lib/db/consignmentStores"
import {
  trackConsignmentApproved,
  trackConsignmentRejected,
} from "@/lib/klaviyo/track-consignor-event"
import type { ConsignmentIntakeSubmitInput, ConsignmentIntakeApproveInput } from "@/lib/validations/consignment"

export type SubmitConsignmentIntakeResult =
  | { ok: true; intakeId: string; listingId: string }
  | { ok: false; error: string; status: number }

export type ApproveConsignmentIntakeResult =
  | { ok: true; listingId: string }
  | { ok: false; error: string; status: number }

function slugifyBase(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "consignment-board"
  )
}

async function resolveUniqueSlug(service: SupabaseClient, base: string): Promise<string> {
  const { count } = await service
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("slug", base)
  if (!count) return base
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`
    const { count: c } = await service
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate)
    if (!c) return candidate
  }
  return `${base}-${Date.now()}`
}

/** Default surfboard category for an intake draft (shop can refine on approval via admin tools). */
async function resolveDefaultBoardCategoryId(service: SupabaseClient): Promise<string | null> {
  const { data } = await service
    .from("categories")
    .select("id")
    .eq("board", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/**
 * Consignor drops a board at a store via QR intake. Creates a hidden, `pending` listing owned by
 * the shop (so the shop is the seller of record + handles messaging) with consignor attribution,
 * plus a `consignment_intakes` audit row awaiting shop approval. Nothing is public until approved.
 */
export async function submitConsignmentIntake(
  consignorProfileId: string,
  input: ConsignmentIntakeSubmitInput,
): Promise<SubmitConsignmentIntakeResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store) {
    return { ok: false, error: "Store not found", status: 404 }
  }
  if (store.status !== "active") {
    return { ok: false, error: "This store is not accepting consignments right now.", status: 409 }
  }
  if (store.ownerProfileId === consignorProfileId) {
    return { ok: false, error: "A store owner cannot consign to their own store.", status: 400 }
  }

  const categoryId = await resolveDefaultBoardCategoryId(service)
  if (!categoryId) {
    return { ok: false, error: "No surfboard category configured. Contact support.", status: 500 }
  }

  const slug = await resolveUniqueSlug(service, slugifyBase(input.title))

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .insert({
      user_id: store.ownerProfileId,
      title: input.title,
      slug,
      description: input.description,
      price: input.consignorProposedPrice,
      condition: input.condition,
      section: "surfboards",
      category_id: categoryId,
      board_type: input.boardType?.trim() || null,
      dimensions: input.dimensions?.trim() || null,
      local_pickup: true,
      shipping_available: false,
      status: "pending",
      hidden_from_site: true,
      consignment_store_id: store.id,
      consignor_profile_id: consignorProfileId,
      intake_status: "pending_approval",
      consignor_proposed_price: input.consignorProposedPrice,
      floor_price: input.floorPrice,
    })
    .select("id")
    .single()

  if (listingErr || !listing) {
    console.error("[consignmentIntake] listing insert failed", listingErr)
    return { ok: false, error: "Could not create the consignment listing", status: 500 }
  }

  const imageRows = input.photoUrls.map((url, index) => ({
    listing_id: listing.id,
    url,
    is_primary: index === 0,
    sort_order: index,
  }))
  const { error: imageErr } = await service.from("listing_images").insert(imageRows)
  if (imageErr) {
    console.error("[consignmentIntake] listing_images insert failed", imageErr)
  }

  const { data: intake, error: intakeErr } = await service
    .from("consignment_intakes")
    .insert({
      store_id: store.id,
      consignor_profile_id: consignorProfileId,
      listing_id: listing.id,
      consignor_proposed_price: input.consignorProposedPrice,
      floor_price: input.floorPrice,
      terms_accepted_at: new Date().toISOString(),
      status: "pending_approval",
    })
    .select("id")
    .single()

  if (intakeErr || !intake) {
    console.error("[consignmentIntake] intake insert failed", intakeErr)
    return { ok: false, error: "Could not record the intake", status: 500 }
  }

  return { ok: true, intakeId: intake.id, listingId: listing.id }
}

/**
 * Shop staff approves an intake: sets the live asking price + commission, flips the listing to
 * active/visible, and indexes it. The consignor's floor stays on the listing for sale-time guards.
 */
export async function approveConsignmentIntake(
  staffProfileId: string,
  input: ConsignmentIntakeApproveInput,
): Promise<ApproveConsignmentIntakeResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data: intake, error: intakeErr } = await service
    .from("consignment_intakes")
    .select("id, store_id, listing_id, floor_price, status, consignor_profile_id")
    .eq("id", input.intakeId)
    .maybeSingle()

  if (intakeErr || !intake) {
    return { ok: false, error: "Intake not found", status: 404 }
  }
  if (!intake.listing_id) {
    return { ok: false, error: "Intake has no listing", status: 409 }
  }
  if (intake.status !== "pending_approval") {
    return { ok: false, error: "This intake has already been handled.", status: 409 }
  }

  const role = await getStoreStaffRole(service, intake.store_id, staffProfileId)
  if (!role) {
    return { ok: false, error: "Only store staff can approve intakes.", status: 403 }
  }

  if (intake.floor_price != null && input.askingPrice < Number(intake.floor_price)) {
    return { ok: false, error: "Asking price cannot be below the consignor's floor.", status: 400 }
  }

  const { error: listingErr } = await service
    .from("listings")
    .update({
      price: input.askingPrice,
      commission_bps: input.commissionBps,
      intake_status: "active",
      status: "active",
      hidden_from_site: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intake.listing_id)

  if (listingErr) {
    console.error("[consignmentIntake] approve listing update failed", listingErr)
    return { ok: false, error: "Could not activate the listing", status: 500 }
  }

  const { error: intakeUpdErr } = await service
    .from("consignment_intakes")
    .update({
      status: "active",
      commission_bps: input.commissionBps,
      approved_by_staff_id: staffProfileId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", intake.id)

  if (intakeUpdErr) {
    console.error("[consignmentIntake] approve intake update failed", intakeUpdErr)
    return { ok: false, error: "Could not update the intake", status: 500 }
  }

  try {
    await syncListingToIndex(service, intake.listing_id)
  } catch {
    // ES is best-effort; listing is live regardless.
  }
  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(service, staffProfileId)

  if (intake.consignor_profile_id) {
    try {
      const [{ data: listingRow }, store] = await Promise.all([
        service.from("listings").select("title, slug").eq("id", intake.listing_id).maybeSingle(),
        getConsignmentStoreById(service, intake.store_id),
      ])
      await trackConsignmentApproved({
        consignorProfileId: intake.consignor_profile_id,
        storeName: store?.name ?? "the shop",
        listingTitle: (listingRow as { title?: string | null } | null)?.title ?? "your board",
        listingSlug: (listingRow as { slug?: string | null } | null)?.slug ?? null,
        askingPriceUsd: input.askingPrice,
      })
    } catch (err) {
      console.error("[consignmentIntake] approved notification failed", err)
    }
  }

  return { ok: true, listingId: intake.listing_id }
}

/** Shop staff rejects an intake: marks it rejected and removes the draft listing from sale. */
export async function rejectConsignmentIntake(
  staffProfileId: string,
  intakeId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data: intake } = await service
    .from("consignment_intakes")
    .select("id, store_id, listing_id, status, consignor_profile_id")
    .eq("id", intakeId)
    .maybeSingle()

  if (!intake) {
    return { ok: false, error: "Intake not found", status: 404 }
  }
  if (intake.status !== "pending_approval") {
    return { ok: false, error: "This intake has already been handled.", status: 409 }
  }

  const role = await getStoreStaffRole(service, intake.store_id, staffProfileId)
  if (!role) {
    return { ok: false, error: "Only store staff can reject intakes.", status: 403 }
  }

  await service
    .from("consignment_intakes")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", intake.id)

  let listingTitle: string | null = null
  if (intake.listing_id) {
    const { data: listingRow } = await service
      .from("listings")
      .update({ status: "removed", intake_status: "rejected", hidden_from_site: true })
      .eq("id", intake.listing_id)
      .select("title")
      .maybeSingle()
    listingTitle = (listingRow as { title?: string | null } | null)?.title ?? null
  }

  if (intake.consignor_profile_id) {
    try {
      const store = await getConsignmentStoreById(service, intake.store_id)
      await trackConsignmentRejected({
        consignorProfileId: intake.consignor_profile_id,
        storeName: store?.name ?? "the shop",
        listingTitle: listingTitle ?? "your board",
      })
    } catch (err) {
      console.error("[consignmentIntake] rejected notification failed", err)
    }
  }

  return { ok: true }
}
