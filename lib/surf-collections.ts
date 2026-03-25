import type { SupabaseClient } from "@supabase/supabase-js"

type SupabaseQueryError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

export type SurfCollectionBoardRow = {
  id: string
  image_url: string
  caption: string | null
  sort_order: number
}

export type SurfCollectionProfile = {
  display_name: string | null
  avatar_url: string | null
}

export type SurfCollectionListRow = {
  id: string
  slug: string
  title: string
  tagline: string | null
  intro: string | null
  cover_image_url: string | null
  sort_order: number
  user_id: string
  profiles: SurfCollectionProfile | null
  surf_collection_boards: SurfCollectionBoardRow[] | null
}

function logPostgrest(scope: string, err: SupabaseQueryError) {
  console.error(
    scope,
    err.message || "(no message)",
    err.code ? `code=${err.code}` : "",
    err.details ? `details=${err.details}` : "",
    err.hint ? `hint=${err.hint}` : "",
  )
}

function sortBoards(boards: SurfCollectionBoardRow[] | null | undefined): SurfCollectionBoardRow[] {
  if (!boards?.length) return []
  return boards.slice().sort((a, b) => a.sort_order - b.sort_order)
}

export function collectionCardImageUrl(row: SurfCollectionListRow): string | undefined {
  const cover = row.cover_image_url?.trim()
  if (cover) return cover
  const boards = sortBoards(row.surf_collection_boards)
  return boards[0]?.image_url?.trim() || undefined
}

/**
 * Loads collections without PostgREST nested selects. Nested embeds often fail with PGRST200
 * (“could not find a relationship…”) until the schema cache reloads, and the error may log as {}.
 */
export async function fetchPublishedSurfCollections(
  supabase: SupabaseClient,
): Promise<SurfCollectionListRow[]> {
  const { data: collections, error: colError } = await supabase
    .from("surf_collections")
    .select("id, slug, title, tagline, intro, cover_image_url, sort_order, user_id")
    .eq("published", true)
    .order("sort_order", { ascending: true })

  if (colError) {
    logPostgrest("fetchPublishedSurfCollections (surf_collections):", colError)
    return []
  }

  if (!collections?.length) return []

  const collectionIds = collections.map((c) => c.id)
  const userIds = [...new Set(collections.map((c) => c.user_id).filter(Boolean))]

  const [boardsRes, profilesRes] = await Promise.all([
    supabase
      .from("surf_collection_boards")
      .select("id, collection_id, image_url, caption, sort_order")
      .in("collection_id", collectionIds)
      .order("sort_order", { ascending: true }),
    userIds.length
      ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[], error: null }),
  ])

  if (boardsRes.error) {
    logPostgrest("fetchPublishedSurfCollections (surf_collection_boards):", boardsRes.error)
  }
  if (profilesRes.error) {
    logPostgrest("fetchPublishedSurfCollections (profiles):", profilesRes.error)
  }

  const boardsByCollection = new Map<string, SurfCollectionBoardRow[]>()
  for (const row of boardsRes.data ?? []) {
    const b: SurfCollectionBoardRow = {
      id: row.id,
      image_url: row.image_url,
      caption: row.caption,
      sort_order: row.sort_order,
    }
    const list = boardsByCollection.get(row.collection_id) ?? []
    list.push(b)
    boardsByCollection.set(row.collection_id, list)
  }

  const profileById = new Map<string, SurfCollectionProfile>()
  for (const p of profilesRes.data ?? []) {
    profileById.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
  }

  return collections.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline,
    intro: c.intro,
    cover_image_url: c.cover_image_url,
    sort_order: c.sort_order,
    user_id: c.user_id,
    profiles: profileById.get(c.user_id) ?? null,
    surf_collection_boards: boardsByCollection.get(c.id) ?? [],
  }))
}

export async function fetchPublishedSurfCollectionBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<SurfCollectionListRow | null> {
  const { data: c, error: colError } = await supabase
    .from("surf_collections")
    .select("id, slug, title, tagline, intro, cover_image_url, sort_order, user_id")
    .eq("published", true)
    .eq("slug", slug)
    .maybeSingle()

  if (colError) {
    logPostgrest("fetchPublishedSurfCollectionBySlug (surf_collections):", colError)
    return null
  }

  if (!c) return null

  const [boardsRes, profileRes] = await Promise.all([
    supabase
      .from("surf_collection_boards")
      .select("id, image_url, caption, sort_order")
      .eq("collection_id", c.id)
      .order("sort_order", { ascending: true }),
    supabase.from("profiles").select("display_name, avatar_url").eq("id", c.user_id).maybeSingle(),
  ])

  if (boardsRes.error) {
    logPostgrest("fetchPublishedSurfCollectionBySlug (surf_collection_boards):", boardsRes.error)
  }
  if (profileRes.error) {
    logPostgrest("fetchPublishedSurfCollectionBySlug (profiles):", profileRes.error)
  }

  const boards: SurfCollectionBoardRow[] = (boardsRes.data ?? []).map((row) => ({
    id: row.id,
    image_url: row.image_url,
    caption: row.caption,
    sort_order: row.sort_order,
  }))

  const profile = profileRes.data
    ? { display_name: profileRes.data.display_name, avatar_url: profileRes.data.avatar_url }
    : null

  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline,
    intro: c.intro,
    cover_image_url: c.cover_image_url,
    sort_order: c.sort_order,
    user_id: c.user_id,
    profiles: profile,
    surf_collection_boards: boards,
  }
}

export function boardsSorted(row: SurfCollectionListRow): SurfCollectionBoardRow[] {
  return sortBoards(row.surf_collection_boards)
}
