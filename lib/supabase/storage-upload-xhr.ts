/**
 * Browser storage upload with XMLHttpRequest so we can report byte progress.
 * Matches public bucket URLs from {@link import('@supabase/supabase-js').StorageClient}.
 */

import { createUploadStallWatch, UploadStallError } from "@/lib/utils/upload-stall-watch"

export type StorageUploadProgress = { loaded: number; total: number }

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
}

export function listingObjectPublicUrl(supabaseUrl: string, pathInBucket: string): string {
  return publicStorageObjectUrl(supabaseUrl, "listings", pathInBucket)
}

export function publicStorageObjectUrl(
  supabaseUrl: string,
  bucket: string,
  pathInBucket: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "")
  return `${base}/storage/v1/object/public/${bucket}/${encodeObjectPath(pathInBucket)}`
}

export async function uploadStorageObjectWithProgress(opts: {
  supabaseUrl: string
  accessToken: string
  anonKey: string
  bucket: string
  /** Path inside the bucket, e.g. `${userId}/${fileName}` */
  pathInBucket: string
  body: Blob
  contentType: string
  upsert?: boolean
  onProgress?: (p: StorageUploadProgress) => void
  signal?: AbortSignal
  /** Abort if no `onprogress` for this many ms (silent hangs on iOS / cellular). */
  stallTimeoutMs?: number
  /** Total request timeout in ms. `0` (default) means no ceiling. */
  timeoutMs?: number
  /** Seconds for `Cache-Control: max-age=…` (Supabase storage). */
  cacheControl?: string
}): Promise<{ pathInBucket: string }> {
  const {
    supabaseUrl,
    accessToken,
    anonKey,
    bucket,
    pathInBucket,
    body,
    contentType,
    upsert = false,
    onProgress,
    signal,
    stallTimeoutMs,
    timeoutMs,
    cacheControl,
  } = opts

  const base = supabaseUrl.replace(/\/$/, "")
  const url = `${base}/storage/v1/object/${bucket}/${encodeObjectPath(pathInBucket)}`

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`)
    xhr.setRequestHeader("apikey", anonKey)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.setRequestHeader("x-upsert", upsert ? "true" : "false")
    if (cacheControl) {
      xhr.setRequestHeader("cache-control", `max-age=${cacheControl}`)
    }
    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      xhr.timeout = timeoutMs
    }

    let stalled = false
    const stallWatch =
      typeof stallTimeoutMs === "number" && stallTimeoutMs > 0
        ? createUploadStallWatch({
            stallMs: stallTimeoutMs,
            onStall: () => {
              stalled = true
              xhr.abort()
            },
          })
        : null

    const onAbort = () => {
      xhr.abort()
    }
    signal?.addEventListener("abort", onAbort)

    const cleanup = () => {
      stallWatch?.stop()
      signal?.removeEventListener("abort", onAbort)
    }

    xhr.upload.onloadstart = () => {
      stallWatch?.ping()
    }

    xhr.upload.onprogress = (evt) => {
      stallWatch?.ping()
      if (evt.lengthComputable && onProgress) {
        onProgress({ loaded: evt.loaded, total: evt.total })
      }
    }

    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) {
        let path = pathInBucket
        try {
          const json = JSON.parse(xhr.responseText) as { Key?: string }
          if (json.Key) {
            const key = json.Key
            const prefix = `${bucket}/`
            path = key.startsWith(prefix) ? key.slice(prefix.length) : key
          }
        } catch {
          /* use pathInBucket */
        }
        resolve({ pathInBucket: path })
        return
      }

      let message = `Upload failed (${xhr.status})`
      try {
        const json = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        if (typeof json.message === "string" && json.message) message = json.message
        else if (typeof json.error === "string" && json.error) message = json.error
      } catch {
        if (xhr.responseText) message = xhr.responseText.slice(0, 200)
      }
      reject(new Error(message))
    }

    xhr.onerror = () => {
      cleanup()
      reject(new Error("Network error during upload"))
    }

    xhr.ontimeout = () => {
      cleanup()
      reject(new Error("Upload timed out. Check your connection and try again."))
    }

    xhr.onabort = () => {
      cleanup()
      if (stalled) {
        reject(new UploadStallError())
        return
      }
      reject(new DOMException("Upload aborted", "AbortError"))
    }

    xhr.send(body)
  })
}
