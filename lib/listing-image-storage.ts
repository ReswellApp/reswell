import type { SupabaseClient } from "@supabase/supabase-js"
import type { PreparedListingImagePair } from "@/lib/listing-image-pipeline"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"

/**
 * Cap concurrent listing storage uploads. Each photo uses one connection at a time (thumb, then
 * full). Allowing several photos in parallel supports multi-select; the old Promise.all full+thumb
 * per photo opened 2×N connections and failed on mobile Safari.
 */
function resolveListingUploadConcurrency(): number {
  if (typeof navigator === "undefined") return 3
  const ua = navigator.userAgent
  const mobile =
    /iPad|iPhone|iPod|Android/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (mobile) return 3
  const cores = navigator.hardwareConcurrency
  if (typeof cores === "number" && cores >= 8) return 4
  return 3
}

type UploadSemaphore = {
  run: <T>(task: () => Promise<T>) => Promise<T>
}

function createUploadSemaphore(maxConcurrency: number): UploadSemaphore {
  const limit = Math.max(1, maxConcurrency)
  let activeCount = 0
  const waiting: Array<() => void> = []

  const release = () => {
    activeCount -= 1
    const next = waiting.shift()
    if (next) next()
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          activeCount += 1
          task().then(
            (value) => {
              release()
              resolve(value)
            },
            (error) => {
              release()
              reject(error)
            },
          )
        }
        if (activeCount < limit) start()
        else waiting.push(start)
      })
    },
  }
}

const listingUploadQueue = createUploadSemaphore(resolveListingUploadConcurrency())

function enqueueListingImageUpload<T>(task: () => Promise<T>): Promise<T> {
  return listingUploadQueue.run(task)
}

async function assertListingUploadAuth(supabase: SupabaseClient): Promise<void> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Sign in again to upload this photo.")
  }
}

async function uploadListingBlob(opts: {
  supabase: SupabaseClient
  pathInBucket: string
  body: Blob
  contentType: string
}): Promise<void> {
  await assertListingUploadAuth(opts.supabase)

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

export async function uploadListingImagePairToSupabase(opts: {
  supabase: SupabaseClient
  userId: string
  clientId: string
  prepared: PreparedListingImagePair
  onProgressFull?: (loaded: number, total: number) => void
  onProgressThumb?: (loaded: number, total: number) => void
}): Promise<{ fullUrl: string; thumbUrl: string }> {
  return enqueueListingImageUpload(async () => {
    const { supabase, userId, clientId, prepared } = opts
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    if (!supabaseUrl) {
      throw new Error("Upload is not configured.")
    }

    const ts = Date.now()
    const fullPath = `${userId}/${ts}-${clientId}-full.${prepared.fullExt}`
    const thumbPath = `${userId}/${ts}-${clientId}-thumb.${prepared.thumbExt}`

    // Thumb first (smaller), then full — one connection at a time for flaky mobile networks.
    await uploadListingBlob({
      supabase,
      pathInBucket: thumbPath,
      body: prepared.thumb,
      contentType: prepared.thumbContentType,
    })
    opts.onProgressThumb?.(prepared.thumb.size, prepared.thumb.size)
    opts.onProgressFull?.(Math.round(prepared.full.size * 0.35), prepared.full.size)

    await uploadListingBlob({
      supabase,
      pathInBucket: fullPath,
      body: prepared.full,
      contentType: prepared.fullContentType,
    })
    opts.onProgressFull?.(prepared.full.size, prepared.full.size)

    return {
      fullUrl: listingObjectPublicUrl(supabaseUrl, fullPath),
      thumbUrl: listingObjectPublicUrl(supabaseUrl, thumbPath),
    }
  })
}
