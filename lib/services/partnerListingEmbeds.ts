import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { slugify } from "@/lib/slugify"
import {
  deletePartnerEmbedListingRow,
  deletePartnerListingEmbed,
  fetchPartnerEmbedPublicPayload,
  getPartnerListingEmbedByIdForAdmin,
  insertPartnerEmbedListing,
  insertPartnerListingEmbed,
  listPartnerEmbedCurationRows,
  listPartnerListingEmbedsForAdmin,
  reorderPartnerEmbedListingRows,
  searchListingsForPartnerEmbedPicker,
  updatePartnerListingEmbed,
  type PartnerEmbedCurationRow,
  type PartnerEmbedPublicPayload,
  type PartnerEmbedSearchHit,
  type PartnerListingEmbedRecord,
} from "@/lib/db/partner-listing-embeds"

function revalidatePartnerEmbed(slug: string) {
  revalidatePath(`/embed/listings/${slug}`)
  revalidatePath(`/api/embed/listings/${slug}`)
}

export async function listPartnerEmbedsForAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; embeds: PartnerListingEmbedRecord[] } | { ok: false; error: string }> {
  try {
    const embeds = await listPartnerListingEmbedsForAdmin(supabase)
    return { ok: true, embeds }
  } catch {
    return { ok: false, error: "Could not load partner embeds" }
  }
}

export async function getPartnerEmbedDetailForAdminService(
  supabase: SupabaseClient,
  embedId: string,
): Promise<
  | { ok: true; embed: PartnerListingEmbedRecord; rows: PartnerEmbedCurationRow[] }
  | { ok: false; error: string; status?: number }
> {
  const embed = await getPartnerListingEmbedByIdForAdmin(supabase, embedId)
  if (!embed) {
    return { ok: false, error: "Embed not found", status: 404 }
  }
  const rows = await listPartnerEmbedCurationRows(supabase, embedId)
  return { ok: true, embed, rows }
}

export async function createPartnerEmbedService(params: {
  name: string
  slug?: string
  partner_label?: string | null
  headline?: string
  subheadline?: string
  cta_primary?: string
  cta_secondary?: string
}): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("createPartnerEmbedService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const baseSlug = (params.slug?.trim() || slugify(params.name)).replace(/^-+|-+$/g, "")
  if (!baseSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseSlug)) {
    return { ok: false, error: "Could not derive a valid slug", status: 400 }
  }

  let slug = baseSlug
  for (let i = 0; i < 5; i++) {
    const bySlug = await svc.from("partner_listing_embeds").select("id").eq("slug", slug).maybeSingle()
    if (!bySlug.data?.id) break
    slug = `${baseSlug}-${i + 2}`
  }

  const result = await insertPartnerListingEmbed(svc, {
    slug,
    name: params.name,
    partner_label: params.partner_label,
    headline: params.headline,
    subheadline: params.subheadline,
    cta_primary: params.cta_primary,
    cta_secondary: params.cta_secondary,
  })

  if (!result.ok) {
    const isDuplicate = /duplicate|unique/i.test(result.error)
    return { ok: false, error: result.error, status: isDuplicate ? 409 : 500 }
  }

  revalidatePartnerEmbed(slug)
  return { ok: true, id: result.id, slug }
}

export async function updatePartnerEmbedService(
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
): Promise<{ ok: true; slug: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("updatePartnerEmbedService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const embed = await getPartnerListingEmbedByIdForAdmin(svc, embedId)
  if (!embed) {
    return { ok: false, error: "Embed not found", status: 404 }
  }

  const result = await updatePartnerListingEmbed(svc, embedId, patch)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }

  revalidatePartnerEmbed(embed.slug)
  return { ok: true, slug: embed.slug }
}

export async function deletePartnerEmbedService(
  embedId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deletePartnerEmbedService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const embed = await getPartnerListingEmbedByIdForAdmin(svc, embedId)
  if (!embed) {
    return { ok: false, error: "Embed not found", status: 404 }
  }

  const result = await deletePartnerListingEmbed(svc, embedId)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }

  revalidatePartnerEmbed(embed.slug)
  return { ok: true, slug: embed.slug }
}

async function assertEligibleSurfboardListing(
  svc: ReturnType<typeof createServiceRoleClient>,
  listingId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const { data: listing, error } = await svc
    .from("listings")
    .select("id, status, hidden_from_site, section")
    .eq("id", listingId)
    .maybeSingle()

  if (error) {
    console.error("assertEligibleSurfboardListing:", error.message)
    return { ok: false, error: "Could not verify listing", status: 500 }
  }
  if (!listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const row = listing as {
    status?: string | null
    hidden_from_site?: boolean | null
    section?: string | null
  }

  if (row.status !== "active" || row.hidden_from_site === true) {
    return { ok: false, error: "Only active, site-visible surfboard listings can be added", status: 400 }
  }
  if (row.section !== "surfboards") {
    return { ok: false, error: "Only surfboard listings can be added", status: 400 }
  }

  return { ok: true }
}

export async function addPartnerEmbedListingService(params: {
  embedId: string
  listingId: string
}): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addPartnerEmbedListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const embed = await getPartnerListingEmbedByIdForAdmin(svc, params.embedId)
  if (!embed) {
    return { ok: false, error: "Embed not found", status: 404 }
  }

  const eligible = await assertEligibleSurfboardListing(svc, params.listingId)
  if (!eligible.ok) return eligible

  const result = await insertPartnerEmbedListing(svc, params.embedId, params.listingId)
  if (!result.ok) {
    const status = result.alreadyExists ? 409 : 500
    return { ok: false, error: result.error, status }
  }

  revalidatePartnerEmbed(embed.slug)
  return { ok: true, id: result.id, slug: embed.slug }
}

export async function deletePartnerEmbedListingService(
  rowId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deletePartnerEmbedListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: row, error } = await svc
    .from("partner_listing_embed_listings")
    .select("embed_id")
    .eq("id", rowId)
    .maybeSingle()

  if (error) {
    console.error("deletePartnerEmbedListingService lookup:", error.message)
    return { ok: false, error: "Could not verify row", status: 500 }
  }
  if (!row?.embed_id) {
    return { ok: false, error: "Row not found", status: 404 }
  }

  const embed = await getPartnerListingEmbedByIdForAdmin(svc, String(row.embed_id))
  if (!embed) {
    return { ok: false, error: "Embed not found", status: 404 }
  }

  const result = await deletePartnerEmbedListingRow(svc, rowId)
  if (!result.ok) {
    const isNotFound = /no row deleted|not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }

  revalidatePartnerEmbed(embed.slug)
  return { ok: true, slug: embed.slug }
}

export async function reorderPartnerEmbedListingsService(
  embedId: string,
  orderedRowIds: string[],
): Promise<{ ok: true; slug: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("reorderPartnerEmbedListingsService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const embed = await getPartnerListingEmbedByIdForAdmin(svc, embedId)
  if (!embed) {
    return { ok: false, error: "Embed not found", status: 404 }
  }

  const result = await reorderPartnerEmbedListingRows(svc, orderedRowIds)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }

  revalidatePartnerEmbed(embed.slug)
  return { ok: true, slug: embed.slug }
}

export async function searchPartnerEmbedPickerService(
  supabase: SupabaseClient,
  embedId: string,
  query: string,
  limit: number,
): Promise<{ ok: true; hits: PartnerEmbedSearchHit[] } | { ok: false; error: string }> {
  try {
    const hits = await searchListingsForPartnerEmbedPicker(supabase, embedId, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchPartnerEmbedPickerService:", e)
    return { ok: false, error: "Could not search listings" }
  }
}

export async function fetchPartnerEmbedPublicService(
  supabase: SupabaseClient,
  slug: string,
  siteOrigin: string,
): Promise<{ ok: true; payload: PartnerEmbedPublicPayload } | { ok: false; error: string; status?: number }> {
  const payload = await fetchPartnerEmbedPublicPayload(supabase, slug, siteOrigin)
  if (!payload) {
    return { ok: false, error: "Embed not found", status: 404 }
  }
  return { ok: true, payload }
}

export function buildPartnerEmbedSnippet(slug: string, siteOrigin: string): string {
  const embedUrl = `${siteOrigin}/embed/listings/${slug}`
  return `<!-- Reswell surfboard listings banner -->
<iframe
  src="${embedUrl}"
  width="100%"
  height="168"
  style="border:0;max-width:920px;display:block;margin:0 auto;"
  loading="lazy"
  title="Surfboards for sale on Reswell"
></iframe>
<script>
  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "reswell-embed-resize") return;
    var origin = "${siteOrigin}";
    if (event.origin !== origin) return;
    var frames = document.querySelectorAll('iframe[src*="/embed/listings/${slug}"]');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source && typeof event.data.height === "number") {
        frames[i].style.height = event.data.height + "px";
      }
    }
  });
</script>`
}
