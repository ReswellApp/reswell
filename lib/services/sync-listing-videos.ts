import type { SupabaseClient } from "@supabase/supabase-js"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-proxy-url"
import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"

export type ListingVideoUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  contentType?: string | null
  durationSeconds?: number | null
  byteSize?: number | null
  sortOrder: number
}

type ExistingListingVideoRow = {
  id: string
  sort_order: number
  url: string
  thumbnail_url: string | null
  content_type: string | null
  duration_seconds: number | null
  byte_size: number | null
}

function normalizedOptionalString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function listingMediaUrlsEquivalent(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return left === right
  if (left === right) return true
  const leftPath = listingStorageObjectPathFromUrl(left)
  const rightPath = listingStorageObjectPathFromUrl(right)
  if (leftPath && rightPath) return leftPath === rightPath
  return false
}

function listingVideoRowNeedsUpdate(
  existing: ExistingListingVideoRow,
  video: ListingVideoUpdateOp,
): boolean {
  if (existing.sort_order !== video.sortOrder) return true
  const url = video.url.trim()
  if (url && !listingMediaUrlsEquivalent(existing.url, url)) return true
  const nextThumb = normalizedOptionalString(video.thumbnailUrl)
  const existingThumb = normalizedOptionalString(existing.thumbnail_url)
  if (existingThumb !== nextThumb) {
    if (!(existingThumb && nextThumb && listingMediaUrlsEquivalent(existingThumb, nextThumb))) {
      return true
    }
  }
  if (normalizedOptionalString(existing.content_type) !== normalizedOptionalString(video.contentType)) {
    return true
  }
  if ((existing.duration_seconds ?? null) !== (video.durationSeconds ?? null)) return true
  if ((existing.byte_size ?? null) !== (video.byteSize ?? null)) return true
  return false
}

function toDbRow(listingId: string, video: ListingVideoUpdateOp) {
  return {
    listing_id: listingId,
    url: video.url.trim(),
    thumbnail_url: normalizedOptionalString(video.thumbnailUrl),
    content_type: normalizedOptionalString(video.contentType),
    duration_seconds: video.durationSeconds ?? null,
    byte_size: video.byteSize ?? null,
    sort_order: video.sortOrder,
  }
}

/** Inserts videos for a newly created listing (no existing rows). */
export async function insertListingVideos(
  supabase: SupabaseClient,
  listingId: string,
  videos: ListingVideoUpdateOp[],
): Promise<void> {
  const rows = videos
    .filter((v) => v.url.trim())
    .map((video, index) =>
      toDbRow(listingId, {
        ...video,
        sortOrder: video.sortOrder ?? index,
      }),
    )
  if (rows.length === 0) return
  const { error } = await supabase.from("listing_videos").insert(rows)
  if (error) throw new Error(error.message)
}

/**
 * Syncs `listing_videos` for a listing update. Removes deleted rows, inserts new
 * videos, and updates metadata. Max one video is enforced by Zod at the boundary.
 */
export async function syncListingVideos(
  supabase: SupabaseClient,
  listingId: string,
  removedVideoIds: string[],
  videos: ListingVideoUpdateOp[],
): Promise<void> {
  if (removedVideoIds.length > 0) {
    const { data: removedRows } = await supabase
      .from("listing_videos")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .in("id", removedVideoIds)
    const removedUrls: string[] = []
    for (const r of removedRows ?? []) {
      if (r.url?.trim()) removedUrls.push(r.url)
      if (r.thumbnail_url?.trim()) removedUrls.push(r.thumbnail_url)
    }
    if (removedUrls.length > 0) {
      await removeListingImageFilesFromStorage(supabase, removedUrls)
    }
    await supabase
      .from("listing_videos")
      .delete()
      .in("id", removedVideoIds)
      .eq("listing_id", listingId)
  }

  const inserts = videos.filter((v) => !v.id && v.url.trim())
  const updates = videos.filter(
    (v): v is ListingVideoUpdateOp & { id: string } => Boolean(v.id),
  )

  let existingById = new Map<string, ExistingListingVideoRow>()
  if (updates.length > 0) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("listing_videos")
      .select("id, sort_order, url, thumbnail_url, content_type, duration_seconds, byte_size")
      .eq("listing_id", listingId)
      .in(
        "id",
        updates.map((v) => v.id),
      )
    if (existingErr) throw new Error(existingErr.message)
    existingById = new Map(
      (existingRows ?? []).map((row) => [row.id as string, row as ExistingListingVideoRow]),
    )
  }

  await Promise.all([
    ...inserts.map(async (video) => {
      const { error } = await supabase.from("listing_videos").insert(toDbRow(listingId, video))
      if (error) throw new Error(error.message)
    }),
    ...updates.map(async (video) => {
      const existing = existingById.get(video.id)
      if (existing && !listingVideoRowNeedsUpdate(existing, video)) return
      const row = toDbRow(listingId, video)
      const { listing_id: _omit, ...rowUpdate } = row
      const { error } = await supabase
        .from("listing_videos")
        .update(rowUpdate)
        .eq("id", video.id)
        .eq("listing_id", listingId)
      if (error) throw new Error(error.message)
    }),
  ])
}

export function listingVideosToUpdateOps(
  videos: Array<{
    id?: string
    url: string
    thumbnailUrl?: string | null
    contentType?: string | null
    durationSeconds?: number | null
    byteSize?: number | null
    sortOrder?: number
  }>,
): ListingVideoUpdateOp[] {
  return videos.map((video, index) => ({
    id: video.id,
    url: video.url,
    thumbnailUrl: video.thumbnailUrl ?? null,
    contentType: video.contentType ?? null,
    durationSeconds: video.durationSeconds ?? null,
    byteSize: video.byteSize ?? null,
    sortOrder: video.sortOrder ?? index,
  }))
}
