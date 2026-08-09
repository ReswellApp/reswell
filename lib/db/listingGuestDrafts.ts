import type { SupabaseClient } from "@supabase/supabase-js"
import type { SellDraftSummary } from "@/lib/services/listingDraftAutosave"

const MAX_GUEST_DRAFTS = 5

type GuestDraftRow = {
  id: string
  user_id: string | null
  status: string
  guest_token_hash: string | null
  section: string | null
}

export async function fetchGuestDraftById(
  service: SupabaseClient,
  listingId: string,
): Promise<GuestDraftRow | null> {
  const { data, error } = await service
    .from("listings")
    .select("id, user_id, status, guest_token_hash, section")
    .eq("id", listingId)
    .maybeSingle()
  if (error || !data) return null
  return data as GuestDraftRow
}

export async function countGuestDraftsForToken(
  service: SupabaseClient,
  tokenHash: string,
  section: "surfboards" | "fins",
): Promise<number> {
  const { count, error } = await service
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("guest_token_hash", tokenHash)
    .eq("status", "draft")
    .eq("section", section)
    .is("user_id", null)
  if (error) throw error
  return count ?? 0
}

export function guestDraftLimitReached(count: number): boolean {
  return count >= MAX_GUEST_DRAFTS
}

export async function listGuestSurfboardDrafts(
  service: SupabaseClient,
  tokenHash: string,
  limit = 20,
): Promise<SellDraftSummary[]> {
  const selectCols = "id, title, price, updated_at, listing_images(url, is_primary, sort_order)"
  const { data, error } = await service
    .from("listings")
    .select(selectCols)
    .eq("guest_token_hash", tokenHash)
    .eq("section", "surfboards")
    .eq("status", "draft")
    .is("user_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) throw error

  type Row = {
    id: string
    title: string | null
    price: number | null
    updated_at: string
    listing_images:
      | { url: string | null; is_primary: boolean | null; sort_order: number | null }[]
      | null
  }
  const rows = (data ?? []) as Row[]
  return rows.map((r) => {
    const imgs = Array.isArray(r.listing_images) ? r.listing_images : []
    const primary =
      imgs.find((i) => i.is_primary) ??
      imgs.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
    const rawTitle = typeof r.title === "string" ? r.title.trim() : ""
    return {
      id: r.id,
      title: rawTitle && rawTitle !== "Untitled draft" ? rawTitle : null,
      price: typeof r.price === "number" ? r.price : null,
      updatedAt: r.updated_at,
      primaryImageUrl: primary?.url ?? null,
    }
  })
}

/**
 * Claim all guest draft rows for this token onto the signed-in user as
 * separate drafts (never merge). Clears guest_token_hash.
 */
export async function claimGuestListingDraftsForUser(
  service: SupabaseClient,
  args: { tokenHash: string; userId: string },
): Promise<{ claimedIds: string[] }> {
  const { data, error } = await service
    .from("listings")
    .update({
      user_id: args.userId,
      guest_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq("guest_token_hash", args.tokenHash)
    .eq("status", "draft")
    .is("user_id", null)
    .select("id")

  if (error) throw error
  const claimedIds = (data ?? [])
    .map((r) => (r as { id: string }).id)
    .filter((id): id is string => typeof id === "string" && Boolean(id))
  return { claimedIds }
}

export async function deleteGuestDraftListing(
  service: SupabaseClient,
  args: { listingId: string; tokenHash: string },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await fetchGuestDraftById(service, args.listingId)
  if (!existing || existing.status !== "draft" || existing.user_id !== null) {
    return { ok: false, status: 404, error: "Draft not found" }
  }
  if (existing.guest_token_hash !== args.tokenHash) {
    return { ok: false, status: 404, error: "Draft not found" }
  }
  const { error } = await service.from("listings").delete().eq("id", args.listingId)
  if (error) return { ok: false, status: 500, error: "Failed to delete draft" }
  return { ok: true }
}
