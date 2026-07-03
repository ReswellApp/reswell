import type { SupabaseClient } from "@supabase/supabase-js"
import { listingHeroSlideSrc, listingTileImageSrcFromRow, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingDetailHref } from "@/lib/listing-href"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"

const EMBED_TABLE = "partner_listing_embeds"
const CURATION_TABLE = "partner_listing_embed_listings"

const CURATION_LISTING_SELECT = `
  id,
  slug,
  title,
  price,
  status,
  hidden_from_site,
  section,
  brand,
  board_type,
  listing_images (url, thumbnail_url, is_primary)
`

type JoinedListing = {
  id: string
  slug: string
  title: string
  price: string | number
  status: string | null
  hidden_from_site: boolean | null
  section: string | null
  brand: string | null
  board_type: string | null
  listing_images: ListingImageForCard[] | null
}

type RawCurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listings: JoinedListing | JoinedListing[] | null
}

export type PartnerListingEmbedRecord = {
  id: string
  slug: string
  name: string
  partner_label: string | null
  headline: string
  subheadline: string
  cta_primary: string
  cta_secondary: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PartnerEmbedCurationRow = {
  id: string
  listing_id: string
  sort_order: number
  listing: {
    id: string
    slug: string
    title: string
    price: number
    status: string | null
    hidden_from_site: boolean | null
    primary_image_url: string | null
  }
}

export type PartnerEmbedPublicListing = {
  id: string
  slug: string
  title: string
  price: number
  price_display: string
  image_url: string | null
  href: string
  subtitle: string | null
}

export type PartnerEmbedPublicPayload = {
  slug: string
  headline: string
  subheadline: string
  cta_primary: string
  cta_secondary: string
  browse_href: string
  listings: PartnerEmbedPublicListing[]
}

function formatEmbedPriceUsd(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price)
}

function listingSubtitle(listing: JoinedListing): string | null {
  const brand = listing.brand?.trim()
  const boardType = listing.board_type?.trim()
  if (brand && boardType) return `${brand} · ${boardType}`
  return brand || boardType || null
}

function isListingEligibleForEmbed(listing: JoinedListing): boolean {
  return (
    listing.status === "active" &&
    listing.hidden_from_site !== true &&
    listing.section === "surfboards"
  )
}

function hydrateCurationRow(row: RawCurationRow): PartnerEmbedCurationRow | null {
  const joined = row.listings
  const listing = Array.isArray(joined) ? joined[0] ?? null : joined
  if (!listing) return null
  const price = publicListingListPriceUsd(listing.price)
  return {
    id: row.id,
    listing_id: row.listing_id,
    sort_order: row.sort_order,
    listing: {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      price,
      status: listing.status,
      hidden_from_site: listing.hidden_from_site,
      primary_image_url: listingHeroSlideSrc(listing.listing_images),
    },
  }
}

export async function listPartnerListingEmbedsForAdmin(
  supabase: SupabaseClient,
): Promise<PartnerListingEmbedRecord[]> {
  const { data, error } = await supabase
    .from(EMBED_TABLE)
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("listPartnerListingEmbedsForAdmin:", error.message)
    return []
  }
  return (data ?? []) as PartnerListingEmbedRecord[]
}

export async function getPartnerListingEmbedByIdForAdmin(
  supabase: SupabaseClient,
  embedId: string,
): Promise<PartnerListingEmbedRecord | null> {
  const { data, error } = await supabase
    .from(EMBED_TABLE)
    .select("*")
    .eq("id", embedId)
    .maybeSingle()

  if (error) {
    console.error("getPartnerListingEmbedByIdForAdmin:", error.message)
    return null
  }
  return (data as PartnerListingEmbedRecord | null) ?? null
}

export async function getPartnerListingEmbedBySlug(
  supabase: SupabaseClient,
  slug: string,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<PartnerListingEmbedRecord | null> {
  let builder = supabase.from(EMBED_TABLE).select("*").eq("slug", slug.trim())
  if (!includeInactive) {
    builder = builder.eq("is_active", true)
  }
  const { data, error } = await builder.maybeSingle()

  if (error) {
    console.error("getPartnerListingEmbedBySlug:", error.message)
    return null
  }
  return (data as PartnerListingEmbedRecord | null) ?? null
}

export async function listPartnerEmbedCurationRows(
  supabase: SupabaseClient,
  embedId: string,
): Promise<PartnerEmbedCurationRow[]> {
  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .select(
      `
      id,
      listing_id,
      sort_order,
      listings:listing_id (${CURATION_LISTING_SELECT})
    `,
    )
    .eq("embed_id", embedId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("listPartnerEmbedCurationRows:", error.message)
    return []
  }

  return (data ?? [])
    .map((row) => hydrateCurationRow(row as unknown as RawCurationRow))
    .filter((r): r is PartnerEmbedCurationRow => r !== null)
}

export async function fetchPartnerEmbedPublicPayload(
  supabase: SupabaseClient,
  slug: string,
  siteOrigin: string,
): Promise<PartnerEmbedPublicPayload | null> {
  const embed = await getPartnerListingEmbedBySlug(supabase, slug)
  if (!embed) return null

  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .select(
      `
      id,
      listing_id,
      sort_order,
      listings:listing_id (${CURATION_LISTING_SELECT})
    `,
    )
    .eq("embed_id", embed.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("fetchPartnerEmbedPublicPayload:", error.message)
    return null
  }

  const listings: PartnerEmbedPublicListing[] = []
  for (const row of data ?? []) {
    const joined = (row as RawCurationRow).listings
    const listing = Array.isArray(joined) ? joined[0] ?? null : joined
    if (!listing || !isListingEligibleForEmbed(listing)) continue

    const price = publicListingListPriceUsd(listing.price)
    const images = listing.listing_images ?? []
    const primary = images.find((img) => img.is_primary) ?? images[0] ?? null
    const imageUrl = primary ? listingTileImageSrcFromRow(primary) || null : null
    const path = listingDetailHref({ id: listing.id, slug: listing.slug })

    listings.push({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      price,
      price_display: formatEmbedPriceUsd(price),
      image_url: imageUrl,
      href: `${siteOrigin}${path}?utm_source=${encodeURIComponent(slug)}&utm_medium=embed&utm_campaign=partner-banner`,
      subtitle: listingSubtitle(listing),
    })
  }

  const browseHref = `${siteOrigin}/boards?utm_source=${encodeURIComponent(slug)}&utm_medium=embed&utm_campaign=partner-banner`

  return {
    slug: embed.slug,
    headline: embed.headline,
    subheadline: embed.subheadline,
    cta_primary: embed.cta_primary,
    cta_secondary: embed.cta_secondary,
    browse_href: browseHref,
    listings,
  }
}

async function readMaxSortOrder(supabase: SupabaseClient, embedId: string): Promise<number> {
  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .select("sort_order")
    .eq("embed_id", embedId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("readMaxSortOrder (partner embed):", error.message)
    return -1
  }
  return typeof data?.sort_order === "number" ? data.sort_order : -1
}

export type InsertPartnerEmbedListingResult =
  | { ok: true; id: string }
  | { ok: false; error: string; alreadyExists?: boolean }

export async function insertPartnerEmbedListing(
  supabase: SupabaseClient,
  embedId: string,
  listingId: string,
): Promise<InsertPartnerEmbedListingResult> {
  const existing = await supabase
    .from(CURATION_TABLE)
    .select("id")
    .eq("embed_id", embedId)
    .eq("listing_id", listingId)
    .maybeSingle()

  if (existing.error) {
    console.error("insertPartnerEmbedListing lookup:", existing.error.message)
    return { ok: false, error: existing.error.message || "Lookup failed" }
  }
  if (existing.data?.id) {
    return { ok: false, error: "Listing is already in this embed", alreadyExists: true }
  }

  const maxOrder = await readMaxSortOrder(supabase, embedId)
  const { data, error } = await supabase
    .from(CURATION_TABLE)
    .insert({ embed_id: embedId, listing_id: listingId, sort_order: maxOrder + 1 })
    .select("id")
    .single()

  if (error) {
    console.error("insertPartnerEmbedListing insert:", error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function deletePartnerEmbedListingRow(
  supabase: SupabaseClient,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from(CURATION_TABLE).delete().eq("id", rowId).select("id")

  if (error) {
    console.error("deletePartnerEmbedListingRow:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "No row deleted (check id)" }
  }
  return { ok: true }
}

export async function reorderPartnerEmbedListingRows(
  supabase: SupabaseClient,
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < orderedRowIds.length; i++) {
    const { error } = await supabase
      .from(CURATION_TABLE)
      .update({ sort_order: i })
      .eq("id", orderedRowIds[i])
    if (error) {
      console.error("reorderPartnerEmbedListingRows:", error.message)
      return { ok: false, error: error.message || "Reorder failed" }
    }
  }
  return { ok: true }
}

export type PartnerEmbedSearchHit = {
  id: string
  slug: string
  title: string
  primary_image_url: string | null
  status: string | null
  hidden_from_site: boolean | null
  already_curated: boolean
}

export async function searchListingsForPartnerEmbedPicker(
  supabase: SupabaseClient,
  embedId: string,
  query: string,
  limit = 20,
): Promise<PartnerEmbedSearchHit[]> {
  const q = query.trim()
  let builder = supabase
    .from("listings")
    .select(
      `id, slug, title, status, hidden_from_site,
       listing_images (url, thumbnail_url, is_primary)`,
    )
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (q) {
    const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
    builder = builder.ilike("title", like)
  }

  const { data, error } = await builder
  if (error) {
    console.error("searchListingsForPartnerEmbedPicker:", error.message)
    return []
  }

  const rows = (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    status: string | null
    hidden_from_site: boolean | null
    listing_images: ListingImageForCard[] | null
  }>

  const ids = rows.map((r) => r.id)
  let curatedIds = new Set<string>()
  if (ids.length > 0) {
    const { data: curated, error: curErr } = await supabase
      .from(CURATION_TABLE)
      .select("listing_id")
      .eq("embed_id", embedId)
      .in("listing_id", ids)
    if (curErr) {
      console.error("searchListingsForPartnerEmbedPicker curated:", curErr.message)
    } else if (Array.isArray(curated)) {
      curatedIds = new Set(curated.map((r) => String((r as { listing_id: string }).listing_id)))
    }
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    hidden_from_site: r.hidden_from_site,
    primary_image_url: listingHeroSlideSrc(r.listing_images),
    already_curated: curatedIds.has(r.id),
  }))
}

export async function insertPartnerListingEmbed(
  supabase: SupabaseClient,
  row: {
    slug: string
    name: string
    partner_label?: string | null
    headline?: string
    subheadline?: string
    cta_primary?: string
    cta_secondary?: string
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(EMBED_TABLE)
    .insert({
      slug: row.slug,
      name: row.name,
      partner_label: row.partner_label ?? null,
      headline: row.headline,
      subheadline: row.subheadline,
      cta_primary: row.cta_primary,
      cta_secondary: row.cta_secondary,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) {
    console.error("insertPartnerListingEmbed:", error.message)
    return { ok: false, error: error.message || "Insert failed" }
  }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function updatePartnerListingEmbed(
  supabase: SupabaseClient,
  embedId: string,
  patch: Partial<{
    name: string
    partner_label: string | null
    headline: string
    subheadline: string
    cta_primary: string
    cta_secondary: string
    is_active: boolean
  }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(EMBED_TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", embedId)
    .select("id")

  if (error) {
    console.error("updatePartnerListingEmbed:", error.message)
    return { ok: false, error: error.message || "Update failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "Embed not found" }
  }
  return { ok: true }
}

export async function deletePartnerListingEmbed(
  supabase: SupabaseClient,
  embedId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from(EMBED_TABLE).delete().eq("id", embedId).select("id")

  if (error) {
    console.error("deletePartnerListingEmbed:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: "Embed not found" }
  }
  return { ok: true }
}
