import type { PreparedListingImagePair } from "@/lib/listing-image-pipeline"
import {
  listingObjectPublicUrl,
  uploadStorageObjectWithProgress,
} from "@/lib/supabase/storage-upload-xhr"

export async function uploadListingImagePairToSupabase(opts: {
  supabaseUrl: string
  accessToken: string
  anonKey: string
  userId: string
  clientId: string
  prepared: PreparedListingImagePair
  onProgressFull?: (loaded: number, total: number) => void
  onProgressThumb?: (loaded: number, total: number) => void
}): Promise<{ fullUrl: string; thumbUrl: string }> {
  const { supabaseUrl, accessToken, anonKey, userId, clientId, prepared } = opts
  const ts = Date.now()
  const fullPath = `${userId}/${ts}-${clientId}-full.${prepared.fullExt}`
  const thumbPath = `${userId}/${ts}-${clientId}-thumb.${prepared.thumbExt}`

  const [fullR, thumbR] = await Promise.all([
    uploadStorageObjectWithProgress({
      supabaseUrl,
      accessToken,
      anonKey,
      bucket: "listings",
      pathInBucket: fullPath,
      body: prepared.full,
      contentType: prepared.fullContentType,
      upsert: false,
      onProgress: opts.onProgressFull
        ? (p) => opts.onProgressFull!(p.loaded, p.total)
        : undefined,
    }),
    uploadStorageObjectWithProgress({
      supabaseUrl,
      accessToken,
      anonKey,
      bucket: "listings",
      pathInBucket: thumbPath,
      body: prepared.thumb,
      contentType: prepared.thumbContentType,
      upsert: false,
      onProgress: opts.onProgressThumb
        ? (p) => opts.onProgressThumb!(p.loaded, p.total)
        : undefined,
    }),
  ])

  return {
    fullUrl: listingObjectPublicUrl(supabaseUrl, fullR.pathInBucket),
    thumbUrl: listingObjectPublicUrl(supabaseUrl, thumbR.pathInBucket),
  }
}
