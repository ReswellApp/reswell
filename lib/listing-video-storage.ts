import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingVideoMimeType } from "@/lib/listing-video-constants"
import {
  listingVideoExtensionForMime,
  normalizeListingVideoMimeType,
} from "@/lib/listing-video-pipeline"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"

async function assertListingUploadAuth(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Sign in again to upload this video.")
  }
  return user.id
}

async function uploadListingBlob(opts: {
  supabase: SupabaseClient
  pathInBucket: string
  body: Blob
  contentType: string
}): Promise<void> {
  const { error } = await opts.supabase.storage.from("listings").upload(
    opts.pathInBucket,
    opts.body,
    {
      contentType: opts.contentType,
      upsert: false,
      cacheControl: "31536000",
    },
  )
  if (error) {
    throw new Error(error.message || "Upload failed")
  }
}

export type UploadedListingVideo = {
  url: string
  thumbnailUrl: string | null
  contentType: ListingVideoMimeType
  durationSeconds: number | null
  byteSize: number
}

export async function uploadListingVideoToSupabase(opts: {
  supabase: SupabaseClient
  clientId: string
  file: File
  durationSeconds: number | null
  poster?: { blob: Blob; contentType: "image/webp" | "image/jpeg"; ext: "webp" | "jpg" } | null
}): Promise<UploadedListingVideo> {
  const userId = await assertListingUploadAuth(opts.supabase)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!supabaseUrl) {
    throw new Error("Upload is not configured.")
  }

  const mime = normalizeListingVideoMimeType(opts.file)
  const ext = listingVideoExtensionForMime(mime)
  const ts = Date.now()
  const videoPath = `${userId}/${ts}-${opts.clientId}-video.${ext}`

  let thumbnailUrl: string | null = null
  if (opts.poster) {
    const posterPath = `${userId}/${ts}-${opts.clientId}-video-poster.${opts.poster.ext}`
    await uploadListingBlob({
      supabase: opts.supabase,
      pathInBucket: posterPath,
      body: opts.poster.blob,
      contentType: opts.poster.contentType,
    })
    thumbnailUrl = listingObjectPublicUrl(supabaseUrl, posterPath)
  }

  await uploadListingBlob({
    supabase: opts.supabase,
    pathInBucket: videoPath,
    body: opts.file,
    contentType: mime,
  })

  return {
    url: listingObjectPublicUrl(supabaseUrl, videoPath),
    thumbnailUrl,
    contentType: mime,
    durationSeconds: opts.durationSeconds,
    byteSize: opts.file.size,
  }
}
