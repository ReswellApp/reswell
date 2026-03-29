/**
 * Browser storage upload with XMLHttpRequest so we can report byte progress.
 * Matches public bucket URLs from {@link import('@supabase/supabase-js').StorageClient}.
 */

export type StorageUploadProgress = { loaded: number; total: number }

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")
}

export function listingObjectPublicUrl(supabaseUrl: string, pathInBucket: string): string {
  const base = supabaseUrl.replace(/\/$/, "")
  return `${base}/storage/v1/object/public/listings/${encodeObjectPath(pathInBucket)}`
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
  } = opts

  const base = supabaseUrl.replace(/\/$/, "")
  const url = `${base}/storage/v1/object/${bucket}/${encodeObjectPath(pathInBucket)}`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`)
    xhr.setRequestHeader("apikey", anonKey)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.setRequestHeader("x-upsert", upsert ? "true" : "false")

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress({ loaded: evt.loaded, total: evt.total })
      }
    }

    xhr.onload = () => {
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

    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.send(body)
  })
}
