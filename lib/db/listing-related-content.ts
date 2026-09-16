import type { SupabaseClient } from "@supabase/supabase-js"
import { parseStoredBlocks } from "@/lib/db/blog-posts"
import { getFieldNoteCoverSrc } from "@/lib/field-notes-articles"
import { listingDetailHref } from "@/lib/listing-href"
import {
  listingCardImageSrc,
  listingImagesFromPrimaryFields,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { parseBlogListingRef } from "@/lib/blog/parse-listing-ref"
import {
  RELATED_CONTENT_KINDS,
  firstBlogArticleImageUrl,
  firstBlogListingEmbedRef,
  isRelatedBlogVisibleOnPdp,
  isRelatedListingVisibleOnPdp,
  relatedContentKindLabel,
  type ListingRelatedContentCard,
  type RelatedContentKind,
} from "@/lib/listing-related-content"

const TABLE = "listing_related_content"

const LISTING_CARD_SELECT =
  "id, slug, title, section, status, hidden_from_site, primary_image_url, primary_thumbnail_url"

const BLOG_CARD_SELECT =
  "id, slug, title, tag, published, listed_on_blog, cover_image_url, og_image_url, updated_at, blocks"

export type ListingRelatedContentRow = {
  id: string
  listing_id: string
  kind: RelatedContentKind
  blog_post_id: string | null
  related_listing_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type RelatedContentListingSummary = {
  id: string
  slug: string | null
  title: string
  section: string | null
  status: string | null
  hidden_from_site: boolean | null
  primary_image_url: string | null
}

export type RelatedContentBlogSummary = {
  id: string
  slug: string
  title: string
  tag: string
  published: boolean
  listed_on_blog: boolean
  cover_image_url: string | null
  og_image_url: string | null
  updated_at: string | null
  tile_image_url: string | null
  embed_listing_ref: string | null
}

export type RelatedContentHostSummary = RelatedContentListingSummary & {
  item_count: number
}

export type RelatedContentAdminItem = {
  id: string
  kind: RelatedContentKind
  sort_order: number
  visible_on_pdp: boolean
  blog: RelatedContentBlogSummary | null
  listing: RelatedContentListingSummary | null
}

export type RelatedContentListingSearchHit = RelatedContentListingSummary & {
  already_curated: boolean
}

export type RelatedContentBlogSearchHit = RelatedContentBlogSummary & {
  already_curated: boolean
}

function escapeIlike(query: string): string {
  return `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`
}

function asKind(value: unknown): RelatedContentKind | null {
  return RELATED_CONTENT_KINDS.includes(value as RelatedContentKind) ? (value as RelatedContentKind) : null
}

function listingImageFromRow(row: {
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
  listing_images?: ListingImageForCard[] | null
}): string | null {
  if (Array.isArray(row.listing_images) && row.listing_images.length > 0) {
    return listingCardImageSrc(row.listing_images) || null
  }
  return listingCardImageSrc(listingImagesFromPrimaryFields(row.primary_image_url, row.primary_thumbnail_url)) || null
}

function mapListingSummary(row: {
  id: string
  slug?: string | null
  title?: string | null
  section?: string | null
  status?: string | null
  hidden_from_site?: boolean | null
  primary_image_url?: string | null
  primary_thumbnail_url?: string | null
}): RelatedContentListingSummary {
  return {
    id: row.id,
    slug: typeof row.slug === "string" ? row.slug : null,
    title: typeof row.title === "string" && row.title.trim() ? row.title : "Untitled listing",
    section: typeof row.section === "string" ? row.section : null,
    status: typeof row.status === "string" ? row.status : null,
    hidden_from_site: row.hidden_from_site === true,
    primary_image_url: listingImageFromRow(row),
  }
}

function mapBlogSummary(row: {
  id: string
  slug?: string | null
  title?: string | null
  tag?: string | null
  published?: boolean | null
  listed_on_blog?: boolean | null
  cover_image_url?: string | null
  og_image_url?: string | null
  updated_at?: string | null
  blocks?: unknown
}): RelatedContentBlogSummary {
  return {
    id: row.id,
    slug: typeof row.slug === "string" ? row.slug : "",
    title: typeof row.title === "string" && row.title.trim() ? row.title : "Untitled post",
    tag: typeof row.tag === "string" && row.tag.trim() ? row.tag : "Journal",
    published: row.published === true,
    listed_on_blog: row.listed_on_blog !== false,
    cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    og_image_url: typeof row.og_image_url === "string" ? row.og_image_url : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    tile_image_url: blogTileImageFromRow(row),
    embed_listing_ref: firstBlogListingEmbedRef(parseStoredBlocks(row.blocks)),
  }
}

function blogProxiedPhoto(url: string | null | undefined, updatedAt: string | null): string | null {
  if (!url?.trim()) return null
  return getFieldNoteCoverSrc({
    slug: "related-content",
    title: "",
    deck: "",
    excerpt: "",
    author: "",
    publishedAt: "2026-01-01",
    readMinutes: 1,
    tag: "Blog",
    coverImage: url,
    updatedAt: updatedAt ?? undefined,
    blocks: [],
  })
}

function blogTileImageFromRow(row: {
  cover_image_url?: string | null
  updated_at?: string | null
  blocks?: unknown
}): string | null {
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null
  const fromCover = blogProxiedPhoto(row.cover_image_url, updatedAt)
  if (fromCover) return fromCover
  return blogProxiedPhoto(firstBlogArticleImageUrl(parseStoredBlocks(row.blocks)), updatedAt)
}

export function mapRelatedContentAdminItem(
  row: ListingRelatedContentRow,
  blog: RelatedContentBlogSummary | null,
  listing: RelatedContentListingSummary | null,
): RelatedContentAdminItem {
  const visible_on_pdp =
    row.kind === "blog"
      ? blog != null && isRelatedBlogVisibleOnPdp(blog)
      : listing != null && isRelatedListingVisibleOnPdp(listing)

  return {
    id: row.id,
    kind: row.kind,
    sort_order: row.sort_order,
    visible_on_pdp,
    blog: row.kind === "blog" ? blog : null,
    listing: row.kind === "listing" ? listing : null,
  }
}

export function mapRelatedContentPublicCard(
  row: ListingRelatedContentRow,
  blog: RelatedContentBlogSummary | null,
  listing: RelatedContentListingSummary | null,
): ListingRelatedContentCard | null {
  if (row.kind === "blog") {
    if (!blog || !isRelatedBlogVisibleOnPdp(blog) || !blog.slug) return null
    return {
      id: row.id,
      kind: "blog",
      href: `/blog/${blog.slug}`,
      title: blog.title,
      imageUrl: blog.tile_image_url ?? `/blog/${blog.slug}/opengraph-image`,
      label: relatedContentKindLabel("blog"),
    }
  }

  if (!listing || !isRelatedListingVisibleOnPdp(listing)) return null
  return {
    id: row.id,
    kind: "listing",
    href: listingDetailHref({ id: listing.id, slug: listing.slug }),
    title: listing.title,
    imageUrl: listing.primary_image_url,
    label: relatedContentKindLabel("listing"),
  }
}

export async function listRelatedContentRows(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingRelatedContentRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, listing_id, kind, blog_post_id, related_listing_id, sort_order, created_at, updated_at")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("listRelatedContentRows:", error.message)
    return []
  }

  const rows: ListingRelatedContentRow[] = []
  for (const raw of data ?? []) {
    const kind = asKind((raw as { kind?: unknown }).kind)
    const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : null
    const hostId =
      typeof (raw as { listing_id?: unknown }).listing_id === "string"
        ? (raw as { listing_id: string }).listing_id
        : null
    if (!kind || !id || !hostId) continue
    rows.push({
      id,
      listing_id: hostId,
      kind,
      blog_post_id:
        typeof (raw as { blog_post_id?: unknown }).blog_post_id === "string"
          ? (raw as { blog_post_id: string }).blog_post_id
          : null,
      related_listing_id:
        typeof (raw as { related_listing_id?: unknown }).related_listing_id === "string"
          ? (raw as { related_listing_id: string }).related_listing_id
          : null,
      sort_order:
        typeof (raw as { sort_order?: unknown }).sort_order === "number"
          ? (raw as { sort_order: number }).sort_order
          : 0,
      created_at:
        typeof (raw as { created_at?: unknown }).created_at === "string"
          ? (raw as { created_at: string }).created_at
          : "",
      updated_at:
        typeof (raw as { updated_at?: unknown }).updated_at === "string"
          ? (raw as { updated_at: string }).updated_at
          : "",
    })
  }
  return rows
}

async function fetchListingsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, RelatedContentListingSummary>> {
  return fetchListingsByRefs(supabase, ids, "id")
}

async function fetchListingsByRefs(
  supabase: SupabaseClient,
  refs: string[],
  match: "id" | "auto" = "auto",
): Promise<Map<string, RelatedContentListingSummary>> {
  const unique = [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))]
  const out = new Map<string, RelatedContentListingSummary>()
  if (unique.length === 0) return out

  const uuidRefs = match === "id" ? unique : unique.filter((ref) => parseBlogListingRef(ref) && looksLikeUuid(ref))
  const slugRefs =
    match === "id" ? [] : unique.filter((ref) => parseBlogListingRef(ref) && !looksLikeUuid(ref))

  const queries: Array<PromiseLike<{ data: unknown; error: { message: string } | null }>> = []
  if (uuidRefs.length > 0) {
    queries.push(supabase.from("listings").select(LISTING_CARD_SELECT).in("id", uuidRefs))
  }
  if (slugRefs.length > 0) {
    queries.push(supabase.from("listings").select(LISTING_CARD_SELECT).in("slug", slugRefs))
  }

  const results = await Promise.all(queries)
  for (const result of results) {
    if (result.error) {
      console.error("fetchListingsByRefs:", result.error.message)
      continue
    }
    for (const row of (result.data as unknown[]) ?? []) {
      const mapped = mapListingSummary(row as Parameters<typeof mapListingSummary>[0])
      out.set(mapped.id, mapped)
      if (mapped.slug) out.set(mapped.slug, mapped)
    }
  }
  return out
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function withEmbedListingTile(
  blog: RelatedContentBlogSummary,
  listings: Map<string, RelatedContentListingSummary>,
): RelatedContentBlogSummary {
  if (blog.tile_image_url || !blog.embed_listing_ref) return blog
  const ref = parseBlogListingRef(blog.embed_listing_ref)
  if (!ref) return blog
  const listing = listings.get(ref)
  if (!listing?.primary_image_url) return blog
  return { ...blog, tile_image_url: listing.primary_image_url }
}

async function fetchBlogsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, RelatedContentBlogSummary>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const out = new Map<string, RelatedContentBlogSummary>()
  if (unique.length === 0) return out

  const { data, error } = await supabase.from("blog_posts").select(BLOG_CARD_SELECT).in("id", unique)
  if (error) {
    console.error("fetchBlogsByIds:", error.message)
    return out
  }
  for (const row of data ?? []) {
    const mapped = mapBlogSummary(row as Parameters<typeof mapBlogSummary>[0])
    out.set(mapped.id, mapped)
  }
  return out
}

export async function hydrateRelatedContentAdminItems(
  supabase: SupabaseClient,
  rows: ListingRelatedContentRow[],
): Promise<RelatedContentAdminItem[]> {
  const [blogs, listings] = await Promise.all([
    fetchBlogsByIds(
      supabase,
      rows.flatMap((row) => (row.blog_post_id ? [row.blog_post_id] : [])),
    ),
    fetchListingsByIds(
      supabase,
      rows.flatMap((row) => (row.related_listing_id ? [row.related_listing_id] : [])),
    ),
  ])

  return rows.map((row) =>
    mapRelatedContentAdminItem(
      row,
      row.blog_post_id ? (blogs.get(row.blog_post_id) ?? null) : null,
      row.related_listing_id ? (listings.get(row.related_listing_id) ?? null) : null,
    ),
  )
}

export async function hydrateRelatedContentPublicCards(
  supabase: SupabaseClient,
  rows: ListingRelatedContentRow[],
): Promise<ListingRelatedContentCard[]> {
  const blogs = await fetchBlogsByIds(
    supabase,
    rows.flatMap((row) => (row.blog_post_id ? [row.blog_post_id] : [])),
  )
  const embedRefs = [...blogs.values()].flatMap((blog) =>
    !blog.tile_image_url && blog.embed_listing_ref ? [blog.embed_listing_ref] : [],
  )
  const [listings, embedListings] = await Promise.all([
    fetchListingsByIds(
      supabase,
      rows.flatMap((row) => (row.related_listing_id ? [row.related_listing_id] : [])),
    ),
    fetchListingsByRefs(supabase, embedRefs),
  ])

  const cards: ListingRelatedContentCard[] = []
  for (const row of rows) {
    const blog = row.blog_post_id ? (blogs.get(row.blog_post_id) ?? null) : null
    const card = mapRelatedContentPublicCard(
      row,
      blog ? withEmbedListingTile(blog, embedListings) : null,
      row.related_listing_id ? (listings.get(row.related_listing_id) ?? null) : null,
    )
    if (card) cards.push(card)
  }
  return cards
}

export async function listRelatedContentHosts(
  supabase: SupabaseClient,
): Promise<RelatedContentHostSummary[]> {
  const { data, error } = await supabase.from(TABLE).select("listing_id")
  if (error) {
    console.error("listRelatedContentHosts:", error.message)
    return []
  }

  const counts = new Map<string, number>()
  for (const raw of data ?? []) {
    const listingId = typeof (raw as { listing_id?: unknown }).listing_id === "string" ? (raw as { listing_id: string }).listing_id : null
    if (!listingId) continue
    counts.set(listingId, (counts.get(listingId) ?? 0) + 1)
  }

  const listingIds = [...counts.keys()]
  if (listingIds.length === 0) return []

  const listings = await fetchListingsByIds(supabase, listingIds)
  return listingIds
    .map((id) => {
      const listing = listings.get(id)
      if (!listing) return null
      return { ...listing, item_count: counts.get(id) ?? 0 }
    })
    .filter((row): row is RelatedContentHostSummary => row != null)
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getListingSummaryById(
  supabase: SupabaseClient,
  listingId: string,
): Promise<RelatedContentListingSummary | null> {
  const { data, error } = await supabase.from("listings").select(LISTING_CARD_SELECT).eq("id", listingId).maybeSingle()
  if (error) {
    console.error("getListingSummaryById:", error.message)
    return null
  }
  if (!data) return null
  return mapListingSummary(data as Parameters<typeof mapListingSummary>[0])
}

export async function searchListingsForRelatedContent(
  supabase: SupabaseClient,
  query: string,
  options: { excludeListingId?: string; curatedIds?: Set<string>; limit: number },
): Promise<RelatedContentListingSearchHit[]> {
  const q = query.trim()
  let builder = supabase
    .from("listings")
    .select(LISTING_CARD_SELECT)
    .order("updated_at", { ascending: false })
    .limit(options.limit)

  if (options.excludeListingId) {
    builder = builder.neq("id", options.excludeListingId)
  }
  if (q) {
    const like = escapeIlike(q)
    builder = builder.or(`title.ilike.${like},slug.ilike.${like}`)
  }

  const { data, error } = await builder
  if (error) {
    console.error("searchListingsForRelatedContent:", error.message)
    return []
  }

  const curated = options.curatedIds ?? new Set<string>()
  return (data ?? []).map((row) => {
    const listing = mapListingSummary(row as Parameters<typeof mapListingSummary>[0])
    return { ...listing, already_curated: curated.has(listing.id) }
  })
}

export async function searchBlogsForRelatedContent(
  supabase: SupabaseClient,
  query: string,
  options: { curatedIds?: Set<string>; limit: number },
): Promise<RelatedContentBlogSearchHit[]> {
  const q = query.trim()
  let builder = supabase
    .from("blog_posts")
    .select(BLOG_CARD_SELECT)
    .order("published_at", { ascending: false })
    .limit(options.limit)

  if (q) {
    const like = escapeIlike(q)
    builder = builder.or(`title.ilike.${like},slug.ilike.${like}`)
  }

  const { data, error } = await builder
  if (error) {
    console.error("searchBlogsForRelatedContent:", error.message)
    return []
  }

  const curated = options.curatedIds ?? new Set<string>()
  return (data ?? []).map((row) => {
    const blog = mapBlogSummary(row as Parameters<typeof mapBlogSummary>[0])
    return { ...blog, already_curated: curated.has(blog.id) }
  })
}

export async function nextRelatedContentSortOrder(
  supabase: SupabaseClient,
  listingId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("sort_order")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("nextRelatedContentSortOrder:", error.message)
    return 0
  }
  const max = typeof data?.sort_order === "number" ? data.sort_order : -1
  return max + 1
}

export async function insertRelatedContentRow(
  supabase: SupabaseClient,
  input: {
    listing_id: string
    kind: RelatedContentKind
    blog_post_id?: string
    related_listing_id?: string
    sort_order: number
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string; alreadyExists?: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      listing_id: input.listing_id,
      kind: input.kind,
      blog_post_id: input.kind === "blog" ? input.blog_post_id : null,
      related_listing_id: input.kind === "listing" ? input.related_listing_id : null,
      sort_order: input.sort_order,
    })
    .select("id")
    .single()

  if (error) {
    console.error("insertRelatedContentRow:", error.message)
    const alreadyExists = /duplicate|unique/i.test(error.message)
    return {
      ok: false,
      error: alreadyExists ? "That item is already attached to this listing" : error.message || "Insert failed",
      alreadyExists,
    }
  }
  if (!data?.id) return { ok: false, error: "No row returned" }
  return { ok: true, id: String(data.id) }
}

export async function deleteRelatedContentRow(
  supabase: SupabaseClient,
  listingId: string,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", rowId)
    .eq("listing_id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("deleteRelatedContentRow:", error.message)
    return { ok: false, error: error.message || "Delete failed" }
  }
  if (!data?.id) return { ok: false, error: "Row not found" }
  return { ok: true }
}

export async function reorderRelatedContentRows(
  supabase: SupabaseClient,
  listingId: string,
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await listRelatedContentRows(supabase, listingId)
  const existingIds = new Set(existing.map((row) => row.id))
  if (orderedRowIds.length !== existingIds.size || orderedRowIds.some((id) => !existingIds.has(id))) {
    return { ok: false, error: "Order must include every attached item" }
  }

  for (let i = 0; i < orderedRowIds.length; i++) {
    const { error } = await supabase.from(TABLE).update({ sort_order: i }).eq("id", orderedRowIds[i]).eq("listing_id", listingId)
    if (error) {
      console.error("reorderRelatedContentRows:", error.message)
      return { ok: false, error: error.message || "Reorder failed" }
    }
  }
  return { ok: true }
}
