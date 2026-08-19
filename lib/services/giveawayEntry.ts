import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGiveawayBySlug,
  getGiveawayPrizeBrand,
  isGiveawayOpen,
  listCurrentGiveaways,
} from "@/lib/giveaways/catalog"
import {
  countGiveawayEvents,
  findPublishedSurfboardId,
  getGiveawayEntryForUser,
  insertGiveawayEvent,
  listGiveawayEntriesForAdmin,
  updateGiveawayEntry,
  upsertGiveawayEntry,
} from "@/lib/db/giveawayEntries"
import {
  trackKlaviyoGiveawayEntered,
  trackKlaviyoGiveawayQualified,
} from "@/lib/klaviyo/track-giveaway-entry"
import { listingDetailHref } from "@/lib/listing-href"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type {
  GiveawayEntry,
  GiveawayEventKind,
  GiveawayEventSurface,
  GiveawayPrizeBrandId,
} from "@/lib/types/giveaways"

export type EnterGiveawayResult =
  | { ok: true; entry: GiveawayEntry; alreadyEntered: boolean }
  | { ok: false; status: number; error: string }

function firstListingId(
  existingId: string | null | undefined,
  incomingId: string | null | undefined,
): string | null {
  return existingId ?? incomingId ?? null
}

export async function enterGiveaway(
  supabase: SupabaseClient,
  params: {
    userId: string
    userEmail?: string | null
    slug: string
    preferredBrand?: GiveawayPrizeBrandId | null
    signedUpFromCta?: boolean
  },
): Promise<EnterGiveawayResult> {
  const giveaway = getGiveawayBySlug(params.slug)
  if (!giveaway) {
    return { ok: false, status: 404, error: "Giveaway not found." }
  }
  if (!isGiveawayOpen(giveaway)) {
    return { ok: false, status: 410, error: "This giveaway is no longer open." }
  }
  if (
    params.preferredBrand &&
    !giveaway.prizeBrands.includes(params.preferredBrand)
  ) {
    return { ok: false, status: 400, error: "Choose one of the prize brands." }
  }

  const existing = await getGiveawayEntryForUser(supabase, params.userId, params.slug)
  const publishedId = giveaway.requiresSurfboardListing
    ? await findPublishedSurfboardId(supabase, params.userId)
    : null
  const listingId = firstListingId(existing?.listingId, publishedId)
  const qualifies = Boolean(listingId)
  const now = new Date().toISOString()

  if (existing) {
    const updated = await updateGiveawayEntry(supabase, {
      userId: params.userId,
      giveawaySlug: params.slug,
      preferredBrand: params.preferredBrand ?? undefined,
      status: qualifies ? "qualified" : existing.status,
      listingId,
      signedUpFromCta: params.signedUpFromCta === true,
      ctaClickedAt: params.signedUpFromCta ? existing.ctaClickedAt ?? now : undefined,
      brandSelectedAt: params.preferredBrand
        ? existing.brandSelectedAt ?? now
        : undefined,
      qualifiedAt: qualifies ? existing.qualifiedAt ?? now : existing.qualifiedAt,
    })
    if (!updated) {
      return { ok: false, status: 500, error: "Could not update your entry." }
    }
    if (qualifies && existing.status !== "qualified") {
      void trackKlaviyoGiveawayQualified({
        userId: params.userId,
        userEmail: params.userEmail,
        giveawaySlug: params.slug,
        listingId: listingId ?? "",
        preferredBrand: updated.preferredBrand,
      })
    }
    return { ok: true, entry: updated, alreadyEntered: true }
  }

  const created = await upsertGiveawayEntry(supabase, {
    userId: params.userId,
    giveawaySlug: params.slug,
    preferredBrand: params.preferredBrand ?? null,
    status: qualifies ? "qualified" : "pending",
    listingId,
    signedUpFromCta: params.signedUpFromCta === true,
    ctaClickedAt: params.signedUpFromCta ? now : null,
    brandSelectedAt: params.preferredBrand ? now : null,
    qualifiedAt: qualifies ? now : null,
  })
  if (!created) {
    return { ok: false, status: 500, error: "Could not save your entry." }
  }

  void trackKlaviyoGiveawayEntered({
    userId: params.userId,
    userEmail: params.userEmail,
    giveawaySlug: params.slug,
    preferredBrand: created.preferredBrand,
    status: created.status,
    listingId,
  })
  if (created.status === "qualified" && listingId) {
    void trackKlaviyoGiveawayQualified({
      userId: params.userId,
      userEmail: params.userEmail,
      giveawaySlug: params.slug,
      listingId,
      preferredBrand: created.preferredBrand,
    })
  }

  return { ok: true, entry: created, alreadyEntered: false }
}

export async function qualifyPublishedListingForGiveaways(
  supabase: SupabaseClient,
  listingId: string,
  sellerUserId: string,
  sellerEmail?: string | null,
): Promise<void> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, section, status, user_id")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return
  if (data.user_id !== sellerUserId) return
  if (data.status === "draft") return
  if (data.section !== "surfboards") return

  const openGiveaways = listCurrentGiveaways().filter(
    (giveaway) => giveaway.requiresSurfboardListing && isGiveawayOpen(giveaway),
  )
  if (openGiveaways.length === 0) return

  const now = new Date().toISOString()
  for (const giveaway of openGiveaways) {
    const existing = await getGiveawayEntryForUser(
      supabase,
      sellerUserId,
      giveaway.slug,
    )
    const lockedListingId = firstListingId(existing?.listingId, listingId)
    if (!lockedListingId) continue

    if (existing?.status === "qualified") {
      if (!existing.listingId) {
        await updateGiveawayEntry(supabase, {
          userId: sellerUserId,
          giveawaySlug: giveaway.slug,
          listingId: lockedListingId,
        })
      }
      continue
    }

    if (existing) {
      const updated = await updateGiveawayEntry(supabase, {
        userId: sellerUserId,
        giveawaySlug: giveaway.slug,
        status: "qualified",
        listingId: lockedListingId,
        qualifiedAt: now,
      })
      if (updated) {
        void trackKlaviyoGiveawayQualified({
          userId: sellerUserId,
          userEmail: sellerEmail,
          giveawaySlug: giveaway.slug,
          listingId: lockedListingId,
          preferredBrand: updated.preferredBrand,
        })
      }
      continue
    }

    const created = await upsertGiveawayEntry(supabase, {
      userId: sellerUserId,
      giveawaySlug: giveaway.slug,
      preferredBrand: null,
      status: "qualified",
      listingId: lockedListingId,
      qualifiedAt: now,
    })
    if (created) {
      void trackKlaviyoGiveawayEntered({
        userId: sellerUserId,
        userEmail: sellerEmail,
        giveawaySlug: giveaway.slug,
        preferredBrand: null,
        status: "qualified",
        listingId: lockedListingId,
      })
      void trackKlaviyoGiveawayQualified({
        userId: sellerUserId,
        userEmail: sellerEmail,
        giveawaySlug: giveaway.slug,
        listingId: lockedListingId,
        preferredBrand: null,
      })
    }
  }
}

export async function recordGiveawayEvent(
  supabase: SupabaseClient,
  params: {
    slug: string
    event: GiveawayEventKind
    surface: GiveawayEventSurface
    preferredBrand?: GiveawayPrizeBrandId | null
    userId?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const giveaway = getGiveawayBySlug(params.slug)
  if (!giveaway || !isGiveawayOpen(giveaway)) {
    return { ok: false, error: "Giveaway not found." }
  }
  try {
    await insertGiveawayEvent(supabase, {
      giveawaySlug: params.slug,
      event: params.event,
      surface: params.surface,
      preferredBrand: params.preferredBrand,
      userId: params.userId,
    })
    return { ok: true }
  } catch (error) {
    console.error(
      "[giveawayEntry] event insert failed",
      error instanceof Error ? error.message : error,
    )
    return { ok: false, error: "Could not record event." }
  }
}

export type GiveawayAdminBrandStat = {
  brandId: GiveawayPrizeBrandId
  brandName: string
  clicks: number
  entries: number
}

export type GiveawayAdminEntry = {
  id: string
  userId: string
  displayName: string | null
  email: string | null
  preferredBrand: GiveawayPrizeBrandId | null
  preferredBrandName: string | null
  status: GiveawayEntry["status"]
  signedUpFromCta: boolean
  listingId: string | null
  listingTitle: string | null
  listingStatus: string | null
  listingHref: string | null
  createdAt: string
  brandSelectedAt: string | null
  qualifiedAt: string | null
}

export type GiveawayAdminDashboard = {
  slug: string
  title: string
  ctaClicks: number
  signupsFromCta: number
  qualifiedEntries: number
  brandStats: GiveawayAdminBrandStat[]
  entries: GiveawayAdminEntry[]
}

export async function getGiveawayAdminDashboard(
  slug: string,
): Promise<GiveawayAdminDashboard | null> {
  const giveaway = getGiveawayBySlug(slug)
  if (!giveaway) return null

  const supabase = createServiceRoleClient()
  const [ctaClicks, rows] = await Promise.all([
    countGiveawayEvents(supabase, { giveawaySlug: slug, event: "cta_click" }),
    listGiveawayEntriesForAdmin(supabase, slug),
  ])

  const brandClickCounts = await Promise.all(
    giveaway.prizeBrands.map(async (brandId) => ({
      brandId,
      clicks: await countGiveawayEvents(supabase, {
        giveawaySlug: slug,
        event: "brand_click",
        preferredBrand: brandId,
      }),
    })),
  )

  const entries: GiveawayAdminEntry[] = rows.map((row) => {
    const brand = (row.preferred_brand as GiveawayPrizeBrandId | null) ?? null
    const listing = row.listing
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.profile?.display_name ?? null,
      email: row.profile?.email ?? null,
      preferredBrand: brand,
      preferredBrandName: brand ? getGiveawayPrizeBrand(brand)?.name ?? brand : null,
      status: row.status as GiveawayEntry["status"],
      signedUpFromCta: row.signed_up_from_cta === true,
      listingId: row.listing_id,
      listingTitle: listing?.title ?? null,
      listingStatus: listing?.status ?? null,
      listingHref: listing
        ? listingDetailHref({ id: listing.id, slug: listing.slug })
        : row.listing_id
          ? listingDetailHref({ id: row.listing_id })
          : null,
      createdAt: row.created_at,
      brandSelectedAt: row.brand_selected_at,
      qualifiedAt: row.qualified_at,
    }
  })

  const entriesByBrand = new Map<GiveawayPrizeBrandId, number>()
  for (const entry of entries) {
    if (!entry.preferredBrand) continue
    entriesByBrand.set(
      entry.preferredBrand,
      (entriesByBrand.get(entry.preferredBrand) ?? 0) + 1,
    )
  }

  return {
    slug: giveaway.slug,
    title: giveaway.title,
    ctaClicks,
    signupsFromCta: entries.filter((entry) => entry.signedUpFromCta).length,
    qualifiedEntries: entries.filter((entry) => entry.status === "qualified").length,
    brandStats: brandClickCounts.map(({ brandId, clicks }) => ({
      brandId,
      brandName: getGiveawayPrizeBrand(brandId)?.name ?? brandId,
      clicks,
      entries: entriesByBrand.get(brandId) ?? 0,
    })),
    entries,
  }
}
